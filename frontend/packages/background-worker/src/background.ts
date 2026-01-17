import { deriveKeyFromPassword, encryptData, decryptData } from "./utils/mask";
import { encode, decode } from "../../shared/z85";
import axios from "axios";

// ============================================
// CONFIGURATION
// ============================================
const API_BASE_URL = "http://localhost:5000/api";
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['Content-Type'] = 'application/json';

console.log("[Background Worker] Starting.. .");

// ============================================
// SETTINGS MANAGEMENT
// ============================================
interface AppSettings {
  autoPredict:  boolean;
  autoBlock: boolean;
  saveHistory: boolean;
  syncBlocklist: boolean;
}

async function getSettings(): Promise<AppSettings> {
  const result = await chrome.storage.local.get('settings');
  return result.settings || {
    autoPredict: false,
    autoBlock: false,
    saveHistory: false,
    syncBlocklist: false
  };
}

async function updateSetting(key: keyof AppSettings, value: boolean): Promise<void> {
  const settings = await getSettings();
  settings[key] = value;
  await chrome.storage.local. set({ settings });
  console.log(`[Settings] ${key} = ${value}`);
}

// ============================================
// TOKEN MANAGEMENT
// ============================================
async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.local.get('access_token');
  return result.access_token || null;
}

async function setTokens(access:  string, refresh: string): Promise<void> {
  await chrome. storage.local.set({ 
    access_token: access, 
    refresh_token: refresh 
  });
}

async function clearTokens(): Promise<void> {
  await chrome.storage.local.remove(['access_token', 'refresh_token', 'key']);
}

// Axios interceptor for automatic token injection
axios.interceptors.request. use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Axios interceptor for token refresh on 401
axios.interceptors. response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?. status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const { refresh_token } = await chrome.storage.local.get('refresh_token');
        const { data } = await axios.post('/refresh', { refresh_token });
        await setTokens(data.access_token, data.refresh_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return axios(originalRequest);
      } catch (refreshError) {
        await clearTokens();
        chrome.runtime.sendMessage({ type: 'AUTH_REQUIRED' });
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// ============================================
// ENCRYPTION KEY MANAGEMENT
// ============================================
async function generateSalt(): Promise<Uint8Array> {
  return crypto.getRandomValues(new Uint8Array(16));
}

async function storeKey(password: string, salt: Uint8Array): Promise<void> {
  const key = await deriveKeyFromPassword(password, salt);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  const jwkString = JSON.stringify(jwk);
  const encodedKey = encode(jwkString);
  await chrome.storage.local. set({ 
    key: encodedKey,
    salt: Array.from(salt)
  });
}

async function retrieveKey(): Promise<CryptoKey> {
  const stored = await chrome.storage.local. get("key");
  if (!stored.key) throw new Error('No encryption key found');
  
  const decodedBytes = decode(stored.key);
  const decodedString = new TextDecoder().decode(decodedBytes);
  const decodedJwk = JSON.parse(decodedString);
  
  return await crypto.subtle.importKey(
    "jwk",
    decodedJwk,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

// ============================================
// BLOCKLIST MANAGEMENT (LOCAL)
// ============================================
interface LocalBlocklistItem {
  url: string;
  blockedAt: string;
  confidence?:  number;
}

async function getLocalBlocklist(): Promise<LocalBlocklistItem[]> {
  const result = await chrome.storage.local. get('blocklist');
  return result.blocklist || [];
}

async function addToLocalBlocklist(url: string, confidence?:  number): Promise<void> {
  const blocklist = await getLocalBlocklist();
  
  // Check if already blocked
  if (blocklist.some(item => item.url === url)) {
    console.log(`[Blocklist] ${url} already blocked`);
    return;
  }
  
  const newItem = {
    url,
    blockedAt: new Date().toISOString(),
    confidence
  };
  
  blocklist.push(newItem);
  
  await chrome.storage.local.set({ blocklist });
  console.log(`[Blocklist] Added ${url}`);
  
  // Update blocking rules
  await updateBlockingRules();
}

async function isUrlBlocked(url: string): Promise<boolean> {
  const blocklist = await getLocalBlocklist();
  return blocklist.some(item => item.url === url || url.includes(item.url));
}

async function removeFromBlocklist(url: string): Promise<void> {
  const blocklist = await getLocalBlocklist();
  const filtered = blocklist.filter(item => item.url !== url);
  await chrome.storage.local.set({ blocklist: filtered });
  console.log(`[Blocklist] Removed ${url}`);
  
  // Update blocking rules
  await updateBlockingRules();
}

// ============================================
// DECLARATIVE NET REQUEST (URL BLOCKING)
// ============================================
async function updateBlockingRules(): Promise<void> {
  try {
    const blocklist = await getLocalBlocklist();
    
    // Remove all existing dynamic rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map(rule => rule.id);
    
    if (existingRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds
      });
    }
    
    // Create new rules from blocklist
    const newRules = blocklist.map((item, index) => {
      const urlObj = new URL(item.url);
      const urlPattern = `*://${urlObj.hostname}/*`;
      
      return {
        id: index + 1,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.BLOCK
        },
        condition: {
          urlFilter: urlPattern,
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.MAIN_FRAME
          ]
        }
      };
    });
    
    if (newRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: newRules
      });
      console.log(`[Blocking] Updated ${newRules.length} blocking rules`);
    } else {
      console.log('[Blocking] No URLs to block');
    }
  } catch (error) {
    console.error('[Blocking] Failed to update rules:', error);
  }
}

// ============================================
// HISTORY MANAGEMENT (LOCAL)
// ============================================
interface LocalHistoryItem {
  url:  string;
  prediction: number;
  confidence:  number;
  checkedAt: string;
  result:  'safe' | 'phishing';
}

async function getLocalHistory(): Promise<LocalHistoryItem[]> {
  const result = await chrome.storage.local.get('history');
  return result.history || [];
}

async function addToLocalHistory(
  url: string, 
  prediction: number, 
  confidence: number
): Promise<void> {
  const settings = await getSettings();
  if (! settings.saveHistory) return;
  
  const history = await getLocalHistory();
  
  history.unshift({
    url,
    prediction,
    confidence,
    checkedAt: new Date().toISOString(),
    result: prediction === 1 ? 'phishing' :  'safe'
  });
  
  // Keep only last 100 entries
  if (history.length > 100) {
    history.splice(100);
  }
  
  await chrome.storage.local.set({ history });
}

async function clearHistory(): Promise<void> {
  await chrome.storage.local.set({ history: [] });
  console.log('[History] Cleared');
}

// ============================================
// API METHODS
// ============================================
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Authentication APIs
async function signup(payload: {
  email: string;
  password: string;
  confirm_password: string;
  encrypted_master_key: string;
  password_salt: string;
  recovery_codes: any[];
}): Promise<ApiResponse> {
  try {
    const { data } = await axios.post('/signup', payload);
    return { success: true, data };
  } catch (error:  any) {
    return { success: false, error: error.response?.data?.detail || 'Signup failed' };
  }
}

async function login(email: string, password: string): Promise<ApiResponse> {
  try {
    const { data } = await axios.post('/login', { email, password });
    await setTokens(data.access_token, data.refresh_token);
    
    await chrome.storage.local.set({
      encrypted_master_key: data.encrypted_master_key,
      password_salt: data.password_salt,
      master_key_version: data.master_key_version,
      user_email: email
    });
    
    return { success: true, data };
  } catch (error: any) {
    return { success:  false, error: error.response?. data?.detail || 'Login failed' };
  }
}

async function verifyOtp(email: string, code: string): Promise<ApiResponse> {
  try {
    const { data } = await axios.post('/verify-otp', { email, code });
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.detail || 'OTP verification failed' };
  }
}

async function logout(): Promise<ApiResponse> {
  await clearTokens();
  return { success: true };
}

// Prediction API
async function predictUrl(url: string): Promise<ApiResponse> {
  try {
    console.log(`[Prediction] Analyzing:  ${url}`);
    const { data } = await axios.post('/predict', { url });
    
    // Save to local history
    await addToLocalHistory(url, data.prediction, data.confidence);
    
    // Auto-block if enabled and phishing detected
    const settings = await getSettings();
    if (settings.autoBlock && data.prediction === 1 && data.confidence > 0.7) {
      await addToLocalBlocklist(url, data.confidence);
      console.log(`[Auto-Block] ${url} (confidence: ${data.confidence})`);
    }
    
    return { success: true, data };
  } catch (error:  any) {
    console.error('[Prediction] Error:', error);
    return { success:  false, error: error.response?. data?.detail || 'Prediction failed' };
  }
}

// Blocklist APIs (with encryption for logged-in users)
async function addToBlocklist(url: string): Promise<ApiResponse> {
  try {
    const token = await getAccessToken();
    
    // Always save locally
    await addToLocalBlocklist(url);
    
    // If logged in and sync enabled, save to backend
    const settings = await getSettings();
    if (token && settings.syncBlocklist) {
      try {
        const key = await retrieveKey();
        const encrypted = await encryptData(url, key);
        
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(url));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const url_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        const payload = {
          encrypted_url: JSON.stringify(encrypted),
          url_hash
        };
        
        await axios.post('/blocklist', payload);
        console.log('[Blocklist] Synced to backend');
      } catch (syncError) {
        console.warn('[Blocklist] Sync failed, saved locally only', syncError);
      }
    }
    
    return { success: true };
  } catch (error: any) {
    return { success:  false, error: error.message || 'Failed to add to blocklist' };
  }
}

async function getBlocklist(): Promise<ApiResponse> {
  try {
    const localBlocklist = await getLocalBlocklist();
    return { success: true, data: localBlocklist };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch blocklist' };
  }
}

async function unblockUrl(url: string): Promise<ApiResponse> {
  try {
    await removeFromBlocklist(url);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// History APIs
async function getHistory(): Promise<ApiResponse> {
  try {
    const localHistory = await getLocalHistory();
    return { success: true, data: localHistory };
  } catch (error: any) {
    return { success: false, error:  error.message };
  }
}

// Settings APIs
async function getSetting(key: keyof AppSettings): Promise<ApiResponse> {
  try {
    const settings = await getSettings();
    return { success: true, data:  settings[key] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function setSetting(key: keyof AppSettings, value: boolean): Promise<ApiResponse> {
  try {
    await updateSetting(key, value);
    return { success: true };
  } catch (error: any) {
    return { success:  false, error: error.message };
  }
}

async function getAllSettings(): Promise<ApiResponse> {
  try {
    const settings = await getSettings();
    return { success: true, data: settings };
  } catch (error:  any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// MESSAGE HANDLER (Frontend ↔ Background)
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        // Auth operations
        case 'SIGNUP': 
          const signupResult = await signup(message.payload);
          sendResponse(signupResult);
          break;
          
        case 'LOGIN': 
          const loginResult = await login(message.payload.email, message. payload.password);
          if (loginResult.success) {
            const { password_salt } = await chrome.storage.local.get('password_salt');
            await storeKey(message.payload.password, new Uint8Array(password_salt));
          }
          sendResponse(loginResult);
          break;
          
        case 'VERIFY_OTP':
          const otpResult = await verifyOtp(message.payload.email, message.payload.code);
          sendResponse(otpResult);
          break;
          
        case 'LOGOUT':
          const logoutResult = await logout();
          sendResponse(logoutResult);
          break;
          
        // Prediction operations
        case 'PREDICT_URL':
          const predictionResult = await predictUrl(message.payload.url);
          sendResponse(predictionResult);
          break;
          
        // Blocklist operations
        case 'ADD_TO_BLOCKLIST':
          const blockResult = await addToBlocklist(message.payload.url);
          sendResponse(blockResult);
          break;
          
        case 'GET_BLOCKLIST':
          const listResult = await getBlocklist();
          sendResponse(listResult);
          break;
          
        case 'UNBLOCK_URL':
          const unblockResult = await unblockUrl(message.payload.url);
          sendResponse(unblockResult);
          break;
          
        // History operations
        case 'GET_HISTORY': 
          const historyResult = await getHistory();
          sendResponse(historyResult);
          break;
          
        case 'CLEAR_HISTORY':
          await clearHistory();
          sendResponse({ success: true });
          break;
          
        // Settings operations
        case 'GET_SETTINGS':
          const settingsResult = await getAllSettings();
          sendResponse(settingsResult);
          break;
          
        case 'UPDATE_SETTING':
          const updateResult = await setSetting(message. payload.key, message.payload. value);
          sendResponse(updateResult);
          break;
          
        // Auth status
        case 'GET_AUTH_STATUS':
          const token = await getAccessToken();
          const email = await chrome.storage.local. get('user_email');
          sendResponse({ 
            success: true, 
            data: { 
              isAuthenticated: !!token,
              email: email. user_email || null
            } 
          });
          break;
          
        case 'CHECK_IF_BLOCKED':
          const isBlocked = await isUrlBlocked(message.payload.url);
          sendResponse({ success: true, data: { isBlocked } });
          break;
          
        default:
          sendResponse({ success: false, error:  'Unknown message type' });
      }
    } catch (error:  any) {
      console.error('[Background Worker] Error:', error);
      sendResponse({ success: false, error:  error.message });
    }
  })();
  
  return true; // Keep message channel open for async response
});

// ============================================
// TAB MONITORING (Auto-Predict Mode)
// ============================================
let lastCheckedUrl: string | null = null;

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only check when page finishes loading
  if (changeInfo.status !== 'complete' || !tab.url) return;
  
  // Skip chrome: // and extension: // URLs
  if (tab.url. startsWith('chrome://') || 
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('about:')) {
    return;
  }
  
  // Check if auto-predict is enabled
  const settings = await getSettings();
  if (!settings.autoPredict) return;
  
  // Avoid duplicate checks
  if (lastCheckedUrl === tab.url) return;
  lastCheckedUrl = tab.url;
  
  try {
    console.log(`[Auto-Predict] Checking ${tab.url}`);
    
    // Check if already blocked
    const isBlocked = await isUrlBlocked(tab.url);
    if (isBlocked) {
      chrome.action.setBadgeText({ text: '🚫', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#DC2626', tabId });
      
      // Show notification
      chrome. notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Aegis:  Blocked URL',
        message: `This site is on your blocklist:  ${new URL(tab.url).hostname}`,
        priority: 2
      });
      return;
    }
    
    // Auto-predict
    const result = await predictUrl(tab.url);
    
    if (result.success && result.data) {
      const { prediction, confidence } = result.data;
      
      if (prediction === 1) {
        // Phishing detected
        const percentage = Math.round(confidence * 100);
        chrome.action.setBadgeText({ text: '⚠️', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#EF4444', tabId });
        
        if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Aegis: Phishing Warning! ',
          message: `This site might be malicious (${percentage}% confidence). Click to block.`,
          priority: 2
        });
      }
        
        console.log(`[Auto-Predict] Phishing detected: ${tab.url} (${percentage}%)`);
      } else {
        // Safe
        chrome.action.setBadgeText({ text: '✓', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#10B981', tabId });
        
        // Clear badge after 3 seconds
        setTimeout(() => {
          chrome.action. setBadgeText({ text: '', tabId });
        }, 3000);
      }
    }
  } catch (error) {
    console.error('[Auto-Predict] Error:', error);
    chrome.action.setBadgeText({ text: '❌', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#6B7280', tabId });
  }
});

// Clear last checked URL when tab is closed
chrome.tabs. onRemoved.addListener((tabId) => {
  lastCheckedUrl = null;
});

// ============================================
// NOTIFICATION CLICK HANDLER
// ============================================
// NOTIFICATION CLICK HANDLER
// ============================================
if (chrome.notifications) {
  chrome.notifications.onClicked.addListener(async (notificationId) => {
    // Open extension popup when notification is clicked
    chrome.action.openPopup();
  });
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize on extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[Extension] ${details.reason}`);
  await updateBlockingRules();
  console.log("[Background Worker] Blocking rules initialized");
});

// Initialize on startup (browser restart)
(async () => {
  await updateBlockingRules();
  console.log("[Background Worker] Started successfully ✓");
})();