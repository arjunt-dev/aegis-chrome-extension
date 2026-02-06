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
/* ============================================
   CONFIG
============================================ */
const API_BASE_URL = "http://localhost:5000/api";
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common["Content-Type"] = "application/json";
axios.defaults.timeout = 8000;
axios.defaults.withCredentials = true;
let ACCESS_TOKEN: string | null = null;
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
        const response = await axios.post("/refresh");
        
        if (response.data.access_token) {
          const newToken = response.data.access_token;
          await setAccessToken(newToken);
          
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

async function clearSession() {
  ACCESS_TOKEN = null;
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
async function predictUrl(url: string) {
  const fullUrl = getBaseUrl(url); // For backend API
  const hostname = getHostname(url); // For blocking/display
  console.log("[Predict] Checking:", fullUrl);

  const { data } = await axios.post("/predict", { url: fullUrl }); // Send full URL to backend

  const settings = await getSettings();
  console.log("Prediction result for", hostname, "is", data.prediction);
  if (settings.autoBlock && data.prediction === 1) {
    console.log("[AutoBlock] Triggered:", hostname);
    await addToBlocklist(hostname); // Pass hostname only
  }

  return data;
}

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

    if (result.prediction === -1) {
      chrome.action.setBadgeText({ text: "⚠️" });

      // Auto-popup the extension if enabled
      if (settings.autoPopup) {
        try {
          await chrome.action.openPopup();
        } catch (popupError) {
          // If openPopup fails (e.g., user gesture required), log it
          console.warn("[AutoPopup] Could not open popup:", popupError);
        }
      }

      if (chrome.notifications) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon.png",
          title: "Aegis Warning",
          message: `Potential phishing site detected: ${hostname}`,
          priority: 2,
        });
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
  const response = await axios.post("/signup", data);
  if (!response.data.success) {
    return response.data.error || "Signup failed";
  }
  return response
}

async function login(email: string, password: string) {
  const response = await axios.post("/login", { email, password });
  if (!response.data.success) {
   return response.data.error || "Login failed";
  }
  return response.data.success,response.data.data as LoginResponse;
}

async function verifyOtp(email:string, code: string) {
  const response = await axios.post("/verify-otp", { code, email });
  if (!response.data.success) {
    return response.data.error || "OTP verification failed";
  }
  return response
}
async function getVault(): Promise<EncryptedPayload | null> {
  const response = await axios.get("/vault");
  if (!response.data.success) {
    throw new Error(response.data.error || "Get vault failed");
  }
  return response.data.success,response.data.data.blob; // Extract blob from VaultResponse
}

async function updateVault(vaultData: EncryptedPayload) {
  const response = await axios.post("/vault", { blob: vaultData });
  if (!response.data.success) {
    throw new Error(response.data.error || "Update vault failed");
  }
  return response
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
             
        case "PREDICT_URL":
          sendResponse({
            success: true,
            data: await predictUrl(message.payload.url),
          });
          break;

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

        case "GET_BLOCKLIST":
          sendResponse({
            success: true,
            data: await getBlocklist(),
          });
          break;

        case "CHECK_IF_BLOCKED": 
          const host = message.payload.url;
          sendResponse({
            success: true,
            data: { isBlocked: await isBlocked(host) },
          });
          break;

        case "VERIFY_OTP":
             const otp= message.payload.code;
              const result = await chrome.storage.session.get("pendingEmail");
              const pendingEmail = result.pendingEmail;
              if (!pendingEmail) {
                sendResponse({ success: false, error: "No Email for OTP verification." });
              }
              const response = await verifyOtp(pendingEmail, otp);
              if (!response.data.success) {
                sendResponse({ success: false, error: response.data.error });
              }
              chrome.storage.session.remove("pendingEmail");
              sendResponse({ success: true });
          break;
        case "SIGNUP":
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
          const signupresponse=await signup(finalpayload);
          if (!signupresponse.data.success) {
            sendResponse({ success: false, error: signupresponse.data.error });
          }
          chrome.storage.session.set({ pendingEmail: message.payload.email });
          sendResponse({ success: signupresponse.data.success, data: signupresponse.data.data });
          break;
        case "LOGIN":
          const logindata: LoginResponse | string = await login(
            message.payload.email,
            message.payload.password,
          );
          if (typeof logindata !== "string") {
            setAccessToken(logindata.access_token);
            const derivedKey = await deriveKeyFromPassword(
              message.payload.password,
              hexToBuffer(logindata.salt),
            );
            const masterKeyHex = await decryptString(
              logindata.enc_master_user_key,
              derivedKey,
            );
            const masterKeyBytes = hexToBuffer(masterKeyHex);
            MASTER_USER_KEY = await importMasterKey(masterKeyBytes);
            sendResponse({ success: true });
          }
          else {
            sendResponse({ success: false, error: logindata });
          }
          
          break;
        case "GET_VAULT":
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

        case "UPDATE_VAULT":
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
  // Get existing settings if any
  const result = await chrome.storage.local.get(['blocklist', 'settings']);
  
  // Initialize blocklist if it doesn't exist
  if (!result.blocklist) {
    await chrome.storage.local.set({ blocklist: [] });
  }
  
  // Merge with default settings, preserving existing user preferences
  const defaultSettings = {
    autoPredict: true,
    autoBlock: true,
    saveHistory: false,
    syncBlocklist: false,
    autoPopup: false,
  };
  
  const mergedSettings = {
    ...defaultSettings,
    ...result.settings, // Preserve existing settings
  };
  
  await chrome.storage.local.set({ settings: mergedSettings });

  await updateBlockingRules();
  console.log("[Init] Extension ready");
});

(async () => {
  await updateBlockingRules();
  console.log("[BG] Running ✓");
})();
