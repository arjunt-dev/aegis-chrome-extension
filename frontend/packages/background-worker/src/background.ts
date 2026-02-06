import axios from "axios";
import {
  deriveKeyFromPassword,
  generateMasterKeyBytes,
  generateSalt,
  encryptString,
  decryptString,
  hexToBuffer,
  bufferToHex,
  importMasterKey,
} from "./utils/mask";
import {
  AppSettings,
  LoginResponse,
  SignupData,
  VaultItem,
  EncryptedPayload,
} from "./utils/types";
import { log } from "console";
/* ============================================
   CONFIG
============================================ */
const API_BASE_URL = "http://localhost:5000/api";
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common["Content-Type"] = "application/json";
axios.defaults.timeout = 30000; // 30 seconds for slow operations like email sending
axios.defaults.withCredentials = true;
let ACCESS_TOKEN: string | null = null;
let REFRESH_TOKEN: string | null = null;
let MASTER_USER_KEY: CryptoKey | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

// Response interceptor for handling 401 errors
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't retry for login, signup, or refresh endpoints
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/login") &&
      !originalRequest.url?.includes("/signup") &&
      !originalRequest.url?.includes("/refresh")
    ) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
            resolve(axios(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = await getRefreshToken();
        if (!storedRefreshToken) {
          throw new Error("No refresh token available");
        }
        
        const response = await axios.post("/refresh", { 
          refresh_token: storedRefreshToken
        });
        
        if (response.data.access_token) {
          const newToken = response.data.access_token;
          await setAccessToken(newToken);
          await setRefreshToken(response.data.refresh_token);
          
          // Retry all queued requests with new token
          onRefreshed(newToken);
          
          // Retry the original request
          originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
          return axios(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear session and redirect to login
        console.error("[Auth] Token refresh failed:", refreshError);
        await clearSession();
        
        // Notify all queued requests that refresh failed
        refreshSubscribers = [];
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);


function requireAuth() {
  if (!MASTER_USER_KEY || !ACCESS_TOKEN) {
    throw new Error("Not authenticated");
  }
  return true;
}

async function storeEncryptedVault(encryptedData: EncryptedPayload) {
  await chrome.storage.session.set({ encryptedVault: encryptedData });
}

async function getEncryptedVault(): Promise<EncryptedPayload | null> {
  const result = await chrome.storage.session.get("encryptedVault");
  return result.encryptedVault || null;
}

async function setAccessToken(token: string) {
  ACCESS_TOKEN = token;
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

async function setRefreshToken(token: string) {
  REFRESH_TOKEN = token;
  await chrome.storage.session.set({ refreshToken: token });
}

async function getRefreshToken(): Promise<string | null> {
  if (REFRESH_TOKEN) return REFRESH_TOKEN;
  const result = await chrome.storage.session.get("refreshToken");
  REFRESH_TOKEN = result.refreshToken || null;
  return REFRESH_TOKEN;
}

async function clearSession() {
  ACCESS_TOKEN = null;
  REFRESH_TOKEN = null;
  delete axios.defaults.headers.common["Authorization"];
  chrome.storage.session.clear();
  MASTER_USER_KEY = null;
}

// Merge local and remote vault items intelligently
function mergeVaultItems(local: VaultItem[], remote: VaultItem[]): VaultItem[] {
  const merged = new Map<string, VaultItem>();
  
  // Add all remote items first
  remote.forEach(item => {
    merged.set(item.hostname, item);
  });
  
  // Merge local items, keeping most recent data
  local.forEach(localItem => {
    const existing = merged.get(localItem.hostname);
    if (!existing) {
      merged.set(localItem.hostname, localItem);
    } else {
      // Merge block status - prefer blocked over unblocked
      if (localItem.block?.enabled) {
        existing.block = localItem.block;
      }
      // Merge history - keep most recent prediction
      if (localItem.history?.datetime && existing.history?.datetime) {
        if (new Date(localItem.history.datetime) > new Date(existing.history.datetime)) {
          existing.history = localItem.history;
        }
      } else if (localItem.history) {
        existing.history = localItem.history;
      }
      // Update timestamp to most recent
      if (new Date(localItem.createdAt) > new Date(existing.createdAt)) {
        existing.createdAt = localItem.createdAt;
      }
    }
  });
  
  return Array.from(merged.values());
}

// Sync local blocklist to vault (encrypt and upload)
async function syncBlocklistToVault() {
  try {
    if (!MASTER_USER_KEY || !ACCESS_TOKEN) {
      console.log("[VaultSync] Not authenticated, skipping sync");
      return;
    }

    const settings = await getSettings();
    if (!settings.syncBlocklist) {
      console.log("[VaultSync] Sync disabled in settings");
      return;
    }

    const localBlocklist = await getBlocklist();
    console.log("[VaultSync] Syncing", localBlocklist.length, "items to vault");

    // Get existing vault data
    let remoteVault: VaultItem[] = [];
    try {
      const cached = await getEncryptedVault();
      if (cached) {
        const decrypted = await decryptString(cached, MASTER_USER_KEY);
        remoteVault = JSON.parse(decrypted);
      } else {
        const remote = await getVault();
        if (remote) {
          const decrypted = await decryptString(remote, MASTER_USER_KEY);
          remoteVault = JSON.parse(decrypted);
        }
      }
    } catch (err) {
      console.log("[VaultSync] No existing vault data, creating new");
    }

    // Merge local and remote
    const merged = mergeVaultItems(localBlocklist, remoteVault);
    console.log("[VaultSync] Merged vault contains", merged.length, "items");

    // Encrypt and upload
    const encrypted = await encryptString(JSON.stringify(merged), MASTER_USER_KEY);
    await updateVault(encrypted);
    await storeEncryptedVault(encrypted);
    
    // Update local blocklist with merged data
    await saveBlocklist(merged);
    await updateBlockingRules();
    
    console.log("[VaultSync] ✓ Successfully synced to vault");
  } catch (error) {
    console.error("[VaultSync] ❌ Failed to sync:", error);
  }
}

// Fetch and merge vault data to local blocklist
async function syncVaultToLocal() {
  try {
    if (!MASTER_USER_KEY || !ACCESS_TOKEN) {
      console.log("[VaultSync] Not authenticated, skipping fetch");
      return;
    }

    const settings = await getSettings();
    if (!settings.syncBlocklist) {
      console.log("[VaultSync] Sync disabled in settings");
      return;
    }

    console.log("[VaultSync] Fetching vault data...");
    const remoteEncrypted = await getVault();
    
    if (!remoteEncrypted) {
      console.log("[VaultSync] No remote vault data found");
      return;
    }

    // Decrypt remote vault
    const decrypted = await decryptString(remoteEncrypted, MASTER_USER_KEY);
    const remoteVault: VaultItem[] = JSON.parse(decrypted);
    console.log("[VaultSync] Retrieved", remoteVault.length, "items from vault");

    // Get local blocklist
    const localBlocklist = await getBlocklist();
    
    // Merge remote and local
    const merged = mergeVaultItems(localBlocklist, remoteVault);
    console.log("[VaultSync] Merged contains", merged.length, "items");

    // Update local storage
    await saveBlocklist(merged);
    await updateBlockingRules();
    await storeEncryptedVault(remoteEncrypted);
    
    console.log("[VaultSync] ✓ Successfully synced from vault");
  } catch (error) {
    console.error("[VaultSync] ❌ Failed to fetch:", error);
  }
}

async function getSettings(): Promise<AppSettings> {
  const result = await chrome.storage.local.get("settings");
  return (
    result.settings || {
      autoPredict: true,
      autoBlock: false,
      autoPopup: true,
      saveHistory: false,
      syncBlocklist: false
    }
  );
}
async function setSettings(settings: AppSettings) {
  await chrome.storage.local.set({ settings });
}

const getBaseUrl = (urlString: string): string => {
  try {
    const urlObj = new URL(urlString);
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch {
    return urlString;
  }
};

// NEW: Extract just the hostname
const getHostname = (urlString: string): string => {
  try {
    const urlObj = new URL(urlString);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    // Already a hostname, just remove www if present
    return urlString.replace(/^www\./, '');
  }
};

// Check if URL is localhost or local development
const isLocalhost = (urlString: string): boolean => {
  try {
    const urlObj = new URL(urlString);
    const hostname = urlObj.hostname.toLowerCase();
    
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) !== null ||
      hostname.endsWith('.local')
    );
  } catch {
    return false;
  }
};

//Local Browser Blocklist Management
async function getBlocklist(): Promise<VaultItem[]> {
  const result = await chrome.storage.local.get("blocklist");
  console.log(result);

  return result.blocklist || [];
}

async function saveBlocklist(list: VaultItem[]) {
  await chrome.storage.local.set({ blocklist: list });
}

async function isBlocked(hostname: string): Promise<boolean> {
  const normalizedHostname = getHostname(hostname);
  const list = await getBlocklist();
  return list.some((i) => i.hostname === normalizedHostname);
}

async function addToBlocklist(hostname: string, predictionData?: { prediction: number, confidence: number }) {
  const normalizedHostname = getHostname(hostname);
  const list = await getBlocklist();
  
  // Check if already exists
  const existingIndex = list.findIndex((i) => i.hostname === normalizedHostname);
  
  if (existingIndex >= 0) {
    // Update existing item with new prediction data if provided
    if (predictionData) {
      list[existingIndex].history = {
        enabled: true,
        datetime: new Date().toISOString(),
        prediction: predictionData.prediction,
        confidence: predictionData.confidence
      };
      list[existingIndex].block = { enabled: true, datetime: new Date().toISOString() };
      await saveBlocklist(list);
      console.log("[Blocklist] Updated:", normalizedHostname);
      
      // Sync to vault if enabled
      const settings = await getSettings();
      if (settings.syncBlocklist && MASTER_USER_KEY && ACCESS_TOKEN) {
        await syncBlocklistToVault();
      }
    }
    return;
  }

  // Add new item
  const newItem: VaultItem = {
    id: crypto.randomUUID(),
    hostname: normalizedHostname,
    createdAt: new Date().toISOString(),
    block: { enabled: true, datetime: new Date().toISOString()},
    history: predictionData ? {
      enabled: true,
      datetime: new Date().toISOString(),
      prediction: predictionData.prediction,
      confidence: predictionData.confidence
    } : { enabled: true, datetime: null },
  };
  
  list.push(newItem);

  await saveBlocklist(list);
  await updateBlockingRules();
  console.log("[Blocklist] Added:", normalizedHostname);
  
  // Sync to vault if enabled
  const settings = await getSettings();
  if (settings.syncBlocklist && MASTER_USER_KEY && ACCESS_TOKEN) {
    await syncBlocklistToVault();
  }
}

async function removeFromBlocklist(hostname: string) {
  const normalizedHostname = getHostname(hostname);
  const list = await getBlocklist();
  const filtered = list.filter((i) => i.hostname !== normalizedHostname);
  console.log("filtered :", filtered);

  await saveBlocklist(filtered);
  await updateBlockingRules();
  console.log("[Blocklist] Removed:", normalizedHostname);
}
/* ============================================
   CHROME BLOCKING RULES
============================================ */
async function updateBlockingRules() {
  try {
    const blocklist:VaultItem[] = await getBlocklist();

    const existing = await chrome.declarativeNetRequest.getDynamicRules();

    if (existing.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existing.map((r) => r.id),
      });
    }

    const rules = blocklist.map((item, index) => ({
      id: index + 1,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.BLOCK,
      },
      condition: {
        requestDomains: [item.hostname],
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
      },
    }));

    if (rules.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules,
      });
    }

    console.log(`[Blocking] Active rules: ${rules.length}`);
  } catch (err) {
    console.error("[Blocking] Failed:", err);
  }
}


/* ============================================
   AUTO PREDICTION
============================================ */
let lastChecked: string | null = null;

chrome.tabs.onUpdated.addListener(async (_, change, tab) => {
  if (change.status !== "complete" || !tab.url) return;
  if (!tab.url || tab.url.startsWith("chrome") || tab.url.startsWith("chrome-extension")) return;

  const settings = await getSettings();
  if (!settings.autoPredict) {
    console.log("[AutoPredict] Disabled in settings");
    return;
  }

  const hostname = getHostname(tab.url); // Use hostname for comparison
  if (hostname === lastChecked) return;
  lastChecked = hostname;

  console.log("[AutoPredict] Checking URL:", tab.url, "| Hostname:", hostname);

  // Skip localhost and local development URLs
  if (isLocalhost(tab.url)) {
    console.log("[AutoPredict] Skipping localhost/local URL:", hostname);
    return;
  }

  // Reset so same site can be rechecked later
  setTimeout(() => {
    lastChecked = null;
  }, 10000);

  try {
    if (await isBlocked(hostname)) {
      console.log("[AutoPredict] URL already blocked:", hostname);
      chrome.action.setBadgeText({ text: "🚫", tabId: tab.id });
      return;
    }

    console.log("[AutoPredict] Running prediction for:", tab.url);
    const result = await predictUrl(tab.url);
    console.log("[AutoPredict] Result:", result);

    if (result.prediction === 1) {
      console.log("[AutoPredict] ⚠️ PHISHING DETECTED:", hostname);
      chrome.action.setBadgeText({ text: "⚠️", tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#ff0000", tabId: tab.id });

      // Show notification
      if (chrome.notifications) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon.png",
          title: "⚠️ Aegis Warning - Phishing Detected!",
          message: `Potential phishing site detected: ${hostname}. Click to view details.`,
          priority: 2,
        });
      }

      // Automatically open extension in a popup window with prediction data (if enabled)
      if (settings.autoPopup) {
        try {
          const params = new URLSearchParams({
            url: tab.url,
            prediction: result.prediction.toString(),
            confidence: result.confidence.toString(),
            autoDetected: 'true'
          });
          const extensionUrl = chrome.runtime.getURL(`chrome-extension/index.html?${params.toString()}`);
          await chrome.windows.create({
            url: extensionUrl,
            type: "popup",
            width: 400,
            height: 600,
            focused: true
          });
          console.log("[AutoPredict] Extension popup opened automatically with prediction data");
        } catch (error) {
          console.log("[AutoPredict] Could not auto-open popup window:", error);
        }
      } else {
        console.log("[AutoPredict] Auto-popup disabled in settings");
      }
    } else {
      console.log("[AutoPredict] ✓ Safe site:", hostname);
      chrome.action.setBadgeText({ text: "✓", tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#00ff00", tabId: tab.id });
      setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id }), 3000);
    }
  } catch (err) {
    console.error("[AutoPredict] ❌ Error:", err);
    chrome.action.setBadgeText({ text: "!", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#ffaa00", tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id }), 3000);
  }
});

async function signup(data: SignupData) {
  try {
    const response = await axios.post("/signup", data);
    return response.data;
  } catch (error: any) {
    // Extract error message from axios error response
    if (error.response?.data?.detail) {
      return error.response.data.detail;
    }
    return error.message || "Signup failed";
  }
}

// Fix login function - Handle axios errors properly
async function login(email: string, password: string) {
  try {
    const response = await axios.post("/login", { email, password });
    return response.data as LoginResponse;
  } catch (error: any) {
    // Extract error message from axios error response
    if (error.response?.data?.detail) {
      return error.response.data.detail;
    }
    return error.message || "Login failed";
  }
}

// Fix verifyOtp function - Handle axios errors properly
async function verifyOtp(email: string, code: string) {
  try {
    const response = await axios.post("/verify-otp", { code, email });
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.detail) {
      return error.response.data.detail;
    }
    return error.message || "OTP verification failed";
  }
}

// Fix getVault function - Handle axios errors properly
async function getVault(): Promise<EncryptedPayload | null> {
  try {
    const response = await axios.get("/vault");
    return response.data.blob;
  } catch (error: any) {
    // Extract error message from axios error response
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error.message || "Get vault failed");
  }
}

// Fix updateVault function - Handle axios errors properly
async function updateVault(vaultData: EncryptedPayload) {
  try {
    const response = await axios.post("/vault", { blob: vaultData });
    return response.data;
  } catch (error: any) {
    // Extract error message from axios error response
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error.message || "Update vault failed");
  }
}

// Fix predictUrl function - Handle axios errors properly
async function predictUrl(url: string) {
  try {
    const fullUrl = getBaseUrl(url);
    const hostname = getHostname(url);
    console.log("[Predict] Checking:", fullUrl);

    if (isLocalhost(url)) {
      console.log("[Predict] Localhost detected - skipping prediction:", hostname);
      throw new Error("");
    }

    const { data } = await axios.post("/predict", { url: fullUrl });
    console.log("[Predict] Response:", data);

    const settings = await getSettings();
    console.log("[Predict] Result for", hostname, "is", data.prediction, "(confidence:", data.confidence, ")");
    
    // Handle phishing detection
    if (data.prediction === 1) {
      if (settings.autoBlock) {
        console.log("[AutoBlock] 🚫 Auto-blocking enabled - adding to blocklist:", hostname);
        await addToBlocklist(hostname, { prediction: data.prediction, confidence: data.confidence });
        console.log("[AutoBlock] ✓ Successfully added to blocklist:", hostname);
      } else if (settings.syncBlocklist && MASTER_USER_KEY && ACCESS_TOKEN) {
        // Even if auto-block is off, update vault with prediction if sync is enabled
        console.log("[VaultSync] Updating vault with phishing detection:", hostname);
        await updateVaultWithPrediction(hostname, data.prediction, data.confidence);
      } else {
        console.log("[AutoBlock] Auto-blocking disabled in settings");
      }
    } else if (settings.syncBlocklist && settings.saveHistory && MASTER_USER_KEY && ACCESS_TOKEN) {
      // For safe URLs, update vault history if both sync and history are enabled
      console.log("[VaultSync] Updating vault with safe URL history:", hostname);
      await updateVaultWithPrediction(hostname, data.prediction, data.confidence);
    }

    return data;
  } catch (error: any) {
    console.error("[Predict] ❌ Error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: url
    });
    
    // Extract error message from axios error response
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error.message || "Prediction failed");
  }
}

// Update vault with prediction data (for authenticated users with sync enabled)
async function updateVaultWithPrediction(hostname: string, prediction: number, confidence: number) {
  try {
    if (!MASTER_USER_KEY || !ACCESS_TOKEN) return;

    const normalizedHostname = getHostname(hostname);
    
    // Get current vault
    let vaultItems: VaultItem[] = [];
    const cached = await getEncryptedVault();
    if (cached) {
      const decrypted = await decryptString(cached, MASTER_USER_KEY);
      vaultItems = JSON.parse(decrypted);
    } else {
      const remote = await getVault();
      if (remote) {
        const decrypted = await decryptString(remote, MASTER_USER_KEY);
        vaultItems = JSON.parse(decrypted);
      }
    }

    // Find or create item
    let item = vaultItems.find(i => i.hostname === normalizedHostname);
    if (!item) {
      item = {
        id: crypto.randomUUID(),
        hostname: normalizedHostname,
        createdAt: new Date().toISOString(),
        block: prediction === 1 ? { enabled: true, datetime: new Date().toISOString() } : null,
        history: {
          enabled: true,
          datetime: new Date().toISOString(),
          prediction,
          confidence
        }
      };
      vaultItems.push(item);
    } else {
      // Update existing item
      item.history = {
        enabled: true,
        datetime: new Date().toISOString(),
        prediction,
        confidence
      };
      if (prediction === 1 && !item.block) {
        item.block = { enabled: true, datetime: new Date().toISOString() };
      }
    }

    // Encrypt and update vault
    const encrypted = await encryptString(JSON.stringify(vaultItems), MASTER_USER_KEY);
    await updateVault(encrypted);
    await storeEncryptedVault(encrypted);
    
    console.log("[VaultSync] ✓ Updated vault with prediction for:", normalizedHostname);
  } catch (error) {
    console.error("[VaultSync] Failed to update vault with prediction:", error);
  }
}

async function getHistory(): Promise<VaultItem[]> {
  const result = await chrome.storage.local.get("history");
  return result.history || [];
}

async function saveHistory(history: VaultItem[]) {
  await chrome.storage.local.set({ history });
}

async function addToHistory(item: VaultItem) {
  const history = await getHistory();
  history.unshift(item); // Add to beginning
  // Keep only last 100 items
  if (history.length > 100) {
    history.splice(100);
  }
  await saveHistory(history);
}

async function clearHistory() {
  await chrome.storage.local.set({ history: [] });
}


chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  (async () => {
    console.log("Received message:", message.type, message.payload);
    try {
      switch (message.type) {
        case "IS_AUTHENTICATED":
          sendResponse({ success: true, data: !!ACCESS_TOKEN });
          break;

        case "GET_SETTINGS":
          sendResponse({
            success: true,
            data: await getSettings(),
          });
          break;
     
        case "UPDATE_SETTINGS": {
          const oldSettings = await getSettings();
          await setSettings(message.payload);
          
          // If syncBlocklist was just enabled, sync local data to vault
          if (!oldSettings.syncBlocklist && message.payload.syncBlocklist && MASTER_USER_KEY && ACCESS_TOKEN) {
            console.log("[Settings] Sync blocklist enabled, syncing local data to vault...");
            await syncBlocklistToVault();
          }
          
          sendResponse({ success: true });
          break;
        }
        
        // ADD: Handle single setting update
        case "UPDATE_SETTING": {
          const currentSettings = await getSettings();
          const oldValue = currentSettings[message.payload.key];
          currentSettings[message.payload.key] = message.payload.value;
          await setSettings(currentSettings);
          
          // If syncBlocklist was just enabled, sync local data to vault
          if (message.payload.key === 'syncBlocklist' && !oldValue && message.payload.value && MASTER_USER_KEY && ACCESS_TOKEN) {
            console.log("[Settings] Sync blocklist enabled, syncing local data to vault...");
            await syncBlocklistToVault();
          }
          
          sendResponse({ success: true });
          break;
        }
             
        case "PREDICT_URL": {
          const result = await predictUrl(message.payload.url);
          
          // Save to local history if saveHistory enabled (for all users)
          // This provides a quick local cache even for authenticated users
          const settings = await getSettings();
          if (settings.saveHistory) {
            await addToHistory({
              id: crypto.randomUUID(),
              hostname: getHostname(message.payload.url),
              createdAt: new Date().toISOString(),
              block: null,
              history: { 
                enabled: true, 
                datetime: new Date().toISOString(),
                prediction: result.prediction,
                confidence: result.confidence 
              },
            });
          }
          
          // Note: Vault sync happens inside predictUrl() for authenticated users
          
          sendResponse({
            success: true,
            data: result,
          });
          break;
        }

        case "ADD_TO_BLOCKLIST": {
          const host = message.payload.url;
          await addToBlocklist(host);
          sendResponse({ success: true });
          break;
        }

        case "REMOVE_FROM_BLOCKLIST": {
          const host = message.payload.url;
          console.log("host is :" + host);
          await removeFromBlocklist(host);
          sendResponse({ success: true });
          break;
        }

        // ADD: Handle UNBLOCK_URL (alias for REMOVE_FROM_BLOCKLIST)
        case "UNBLOCK_URL": {
          const host = message.payload.url;
          await removeFromBlocklist(host);
          sendResponse({ success: true });
          break;
        }

        case "GET_BLOCKLIST":
          sendResponse({
            success: true,
            data: await getBlocklist(),
          });
          break;

        case "CHECK_IF_BLOCKED": {
          const host = message.payload.url;
          sendResponse({
            success: true,
            data: { isBlocked: await isBlocked(host) },
          });
          break;
        }

        // ADD: History handlers
        case "GET_HISTORY": {
          let allHistory: VaultItem[] = [];
          
          // Get local history (for non-authenticated or when saveHistory is enabled)
          const localHistory = await getHistory();
          allHistory = [...localHistory];
          
          // If authenticated and sync is enabled, also get history from vault/blocklist
          const settings = await getSettings();
          if (settings.syncBlocklist && MASTER_USER_KEY && ACCESS_TOKEN) {
            try {
              // Get blocklist items (which may contain prediction history from vault)
              const blocklist = await getBlocklist();
              // Filter items that have history data and aren't already in local history
              const vaultHistory = blocklist.filter(item => 
                item.history?.datetime && 
                !allHistory.some(h => h.hostname === item.hostname)
              );
              allHistory = [...allHistory, ...vaultHistory];
            } catch (err) {
              console.error("[History] Error fetching vault history:", err);
            }
          }
          
          // Sort by most recent first
          allHistory.sort((a, b) => {
            const dateA = a.history?.datetime || a.createdAt;
            const dateB = b.history?.datetime || b.createdAt;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
          
          sendResponse({
            success: true,
            data: allHistory,
          });
          break;
        }

        case "CLEAR_HISTORY":
          await clearHistory();
          sendResponse({ success: true });
          break;

        case "VERIFY_OTP": {
          const otp = message.payload.code;
          const result = await chrome.storage.session.get("pendingEmail");
          const pendingEmail = result.pendingEmail;
          if (!pendingEmail) {
            sendResponse({ success: false, error: "No Email for OTP verification." });
            break;
          }
          const response = await verifyOtp(pendingEmail, otp);
          if (typeof response === "string") {
            sendResponse({ success: false, error: response });
            break;
          }
          await chrome.storage.session.remove("pendingEmail");
          sendResponse({ success: true, data: response });
          break;
        }

        case "SIGNUP": {
          const salt = generateSalt();
          const enc_key = await deriveKeyFromPassword(
            message.payload.password,
            salt,
          );
          const key = generateMasterKeyBytes();
          const enc_master_user_key = await encryptString(
            bufferToHex(key),
            enc_key,
          );
          const finalpayload: SignupData = {
            email: message.payload.email,
            password: message.payload.password,
            confirm_password: message.payload.confirm_password,
            salt: bufferToHex(salt),
            enc_master_user_key,
          };
          const signupresponse = await signup(finalpayload);
          
          if (typeof signupresponse === "string") {
            sendResponse({ success: false, error: signupresponse });
            break;
          }
          await chrome.storage.session.set({ pendingEmail: message.payload.email });
          sendResponse({ success: true, data: signupresponse });
          break;
        }

        case "LOGIN": {
          const logindata: LoginResponse | string = await login(
            message.payload.email,
            message.payload.password,
          );
          if (typeof logindata !== "string") {
            await setAccessToken(logindata.access_token);
            await setRefreshToken(logindata.refresh_token);
            const derivedKey = await deriveKeyFromPassword(
              message.payload.password,
              hexToBuffer(logindata.salt),
            );
            const masterKeyHex = await decryptString(
              logindata.enc_master_user,
              derivedKey,
            );
            const masterKeyBytes = hexToBuffer(masterKeyHex);
            MASTER_USER_KEY = await importMasterKey(masterKeyBytes);
            
            // After successful login, sync vault to local if syncBlocklist is enabled
            const settings = await getSettings();
            if (settings.syncBlocklist) {
              console.log("[Login] Syncing vault data to local storage...");
              await syncVaultToLocal();
            }
            
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: logindata });
          }
          break;
        }

        case "GET_VAULT": {
          requireAuth();
          let cached = await getEncryptedVault();
          if (!cached) {
            cached = await getVault();
            if (!cached) {
              sendResponse({ success: true, data: [] });
              break;
            }
            await storeEncryptedVault(cached);
          }
          const decrypted = await decryptString(cached, MASTER_USER_KEY);
          sendResponse({ success: true, data: JSON.parse(decrypted) });
          break;
        }

        case "UPDATE_VAULT": {
          requireAuth();
          // This case is now handled by syncBlocklistToVault
          // Keeping for backward compatibility
          await syncBlocklistToVault();
          sendResponse({ success: true });
          break;
        }
        
        case "SYNC_VAULT": {
          requireAuth();
          await syncBlocklistToVault();
          sendResponse({ success: true });
          break;
        }

        case "LOGOUT":
          await clearSession();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: "Unknown message" });
      }
    } catch (err: any) {
      console.error("[BG ERROR]", err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true;
});

/* ============================================
   INIT
============================================ */
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    blocklist: [],
    history: [], 
    settings: { 
      autoPredict: false, 
      autoBlock: false,
      autoPopup: false,
      saveHistory: false, 
      syncBlocklist: false 
    },
  });

  await updateBlockingRules();
  console.log("[Init] Extension ready");
});

/* ============================================
   STARTUP - Restore refresh token from storage and blocking rules
============================================ */
chrome.runtime.onStartup.addListener(async () => {
  const storedRefreshToken = await getRefreshToken();
  if (storedRefreshToken) {
    console.log("[Startup] Refresh token restored from storage");
  }

  // Restore blocking rules
  await updateBlockingRules();
  console.log("[Startup] Blocking rules restored");
});
