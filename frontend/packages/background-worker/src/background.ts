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

async function getSettings(): Promise<AppSettings> {
  const result = await chrome.storage.local.get("settings");
  return (
    result.settings || {
      autoPredict: false,
      autoBlock: false,
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

async function addToBlocklist(hostname: string) {
  const normalizedHostname = getHostname(hostname);
  const list = await getBlocklist();
  
  if (list.some((i) => i.hostname === normalizedHostname)) return;
  
  const settings = await getSettings();
  if (!settings.saveHistory) {
    history = null;
  }
  
  list.push({
    id: crypto.randomUUID(),
    hostname: normalizedHostname,
    createdAt: new Date().toISOString(),
    block: { enabled: true, datetime: new Date().toISOString()},
    history: { enabled: true, datetime: null },
  });

  await saveBlocklist(list);
  await updateBlockingRules();
  console.log("[Blocklist] Added:", normalizedHostname);
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
   PREDICTION
============================================ */
// async function predictUrl(url: string) {
//   const fullUrl = getBaseUrl(url); // For backend API
//   const hostname = getHostname(url); // For blocking/display
//   console.log("[Predict] Checking:", fullUrl);

//   const { data } = await axios.post("/predict", { url: fullUrl }); // Send full URL to backend

//   const settings = await getSettings();
//   console.log("Prediction result for", hostname, "is", data.prediction);
//   if (settings.autoBlock && data.prediction === 1) {
//     console.log("[AutoBlock] Triggered:", hostname);
//     await addToBlocklist(hostname); // Pass hostname only
//   }

//   return data;
// }

/* ============================================
   AUTO PREDICTION
============================================ */
let lastChecked: string | null = null;

chrome.tabs.onUpdated.addListener(async (_, change, tab) => {
  if (change.status !== "complete" || !tab.url) return;
  if (tab.url.startsWith("chrome")) return;

  const settings = await getSettings();
  if (!settings.autoPredict) return;

  const hostname = getHostname(tab.url); // Use hostname for comparison
  if (hostname === lastChecked) return;
  lastChecked = hostname;

  // Reset so same site can be rechecked later
  setTimeout(() => {
    lastChecked = null;
  }, 10000);

  try {
    if (await isBlocked(hostname)) {
      chrome.action.setBadgeText({ text: "🚫" });
      return;
    }

    const result = await predictUrl(tab.url);

    if (result.prediction === 1) {
      chrome.action.setBadgeText({ text: "⚠️" });

      // Show notification
      if (chrome.notifications) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon.png",
          title: "Aegis Warning - Phishing Detected!",
          message: `Potential phishing site detected: ${hostname}. Click to view details.`,
          priority: 2,
        });
      }

      // Automatically open extension in a popup window (more reliable than openPopup)
      try {
        const extensionUrl = chrome.runtime.getURL("chrome-extension/index.html");
        await chrome.windows.create({
          url: extensionUrl,
          type: "popup",
          width: 400,
          height: 600,
          focused: true
        });
        console.log("[AutoPredict] Extension popup opened automatically");
      } catch (error) {
        console.log("[AutoPredict] Could not auto-open popup window:", error);
      }
    } else {
      chrome.action.setBadgeText({ text: "✓" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);
    }
  } catch (err) {
    console.warn("[AutoPredict] Failed:", err);
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

    const { data } = await axios.post("/predict", { url: fullUrl });

    const settings = await getSettings();
    console.log("Prediction result for", hostname, "is", data.prediction);
    if (settings.autoBlock && data.prediction === 1) {
      console.log("[AutoBlock] Triggered:", hostname);
      await addToBlocklist(hostname);
    }

    return data;
  } catch (error: any) {
    // Extract error message from axios error response
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error.message || "Prediction failed");
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
/* ============================================
   MESSAGE HANDLER (UI ↔ BG)
============================================ */

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  (async () => {
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
     
        case "UPDATE_SETTINGS":
          await setSettings(message.payload);
          sendResponse({ success: true });
          break;
        
        // ADD: Handle single setting update
        case "UPDATE_SETTING": {
          const currentSettings = await getSettings();
          currentSettings[message.payload.key] = message.payload.value;
          await setSettings(currentSettings);
          sendResponse({ success: true });
          break;
        }
             
        case "PREDICT_URL": {
          const result = await predictUrl(message.payload.url);
          
          // Save to history if enabled
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
        case "GET_HISTORY":
          sendResponse({
            success: true,
            data: await getHistory(),
          });
          break;

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
          let currentEncrypted = await getEncryptedVault();
          let vaultItems: VaultItem[] = [];
          if (currentEncrypted) {
            const decrypted = await decryptString(
              currentEncrypted,
              MASTER_USER_KEY,
            );
            vaultItems = JSON.parse(decrypted);
          }
          vaultItems.push(message.payload);
          const newEncrypted = await encryptString(
            JSON.stringify(vaultItems),
            MASTER_USER_KEY,
          );
          await storeEncryptedVault(newEncrypted);
          await updateVault(newEncrypted);
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
      autoPredict: true, 
      autoBlock: false,
      saveHistory: false, 
      syncBlocklist: false 
    },
  });

  await updateBlockingRules();
  console.log("[Init] Extension ready");
});

/* ============================================
   STARTUP - Restore refresh token from storage
============================================ */
chrome.runtime.onStartup.addListener(async () => {
  const storedRefreshToken = await getRefreshToken();
  if (storedRefreshToken) {
    console.log("[Startup] Refresh token restored from storage");
  }
});
