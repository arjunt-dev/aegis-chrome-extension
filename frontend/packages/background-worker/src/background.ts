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
  exportMasterKey,
  importMasterKeyFromJWK,
  deriveAuthHash,
} from "./utils/mask";
import {
  AppSettings,
  LoginResponse,
  SignupData,
  VaultItem,
  EncryptedPayload,
  PreLoginResponse,
  PredictionLabel,
} from "./utils/types";




const API_BASE_URL = "http://localhost:5000/api";
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common["Content-Type"] = "application/json";
axios.defaults.timeout = 30000; 
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

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
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
          
          onRefreshed(newToken);
          
          originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
          return axios(originalRequest);
        }
      } catch (refreshError) {
        console.error("[Auth] Token refresh failed:", refreshError);
        await clearSession();
        
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
  await chrome.storage.session.set({ accessToken: token });
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


async function restoreSession(): Promise<void> {
  if (!ACCESS_TOKEN) {
    const result = await chrome.storage.session.get(["accessToken", "refreshToken"]);
    if (result.accessToken) {
      ACCESS_TOKEN = result.accessToken;
      axios.defaults.headers.common["Authorization"] = `Bearer ${result.accessToken}`;
    }
    if (result.refreshToken) {
      REFRESH_TOKEN = result.refreshToken;
    }
  }
}

async function clearSession() {
  ACCESS_TOKEN = null;
  REFRESH_TOKEN = null;
  delete axios.defaults.headers.common["Authorization"];
  await chrome.storage.session.clear();
  MASTER_USER_KEY = null;
}


async function storeMasterKey(key: CryptoKey) {
  try {
    const jwk = await exportMasterKey(key);
    await chrome.storage.session.set({ masterKeyJWK: jwk });
    console.log("[Session] Master key stored securely");
  } catch (error) {
    console.error("[Session] Failed to store master key:", error);
  }
}

async function restoreMasterKey(): Promise<CryptoKey | null> {
  try {
    const result = await chrome.storage.session.get("masterKeyJWK");
    if (result.masterKeyJWK) {
      const key = await importMasterKeyFromJWK(result.masterKeyJWK);
      console.log("[Session] Master key restored from session storage");
      return key;
    }
    return null;
  } catch (error) {
    console.error("[Session] Failed to restore master key:", error);
    return null;
  }
}


async function ensureMasterKey(): Promise<boolean> {
  if (MASTER_USER_KEY) return true;
  
  MASTER_USER_KEY = await restoreMasterKey();
  if (MASTER_USER_KEY) {
    console.log("[Session] Master key restored for sync operation");
    return true;
  }
  
  console.log("[Session] Master key not available - user needs to login");
  return false;
}

function mergeVaultItems(local: VaultItem[], remote: VaultItem[]): VaultItem[] {
  const merged = new Map<string, VaultItem>();
  
  remote.forEach(item => {
    merged.set(item.hostname, item);
  });
  
  local.forEach(localItem => {
    const existing = merged.get(localItem.hostname);
    if (!existing) {
      merged.set(localItem.hostname, localItem);
    } else {
      if (new Date(localItem.lastChecked) > new Date(existing.lastChecked)) {
        merged.set(localItem.hostname, localItem);
      } else if (new Date(localItem.lastChecked).getTime() === new Date(existing.lastChecked).getTime()) {
        if (localItem.isBlocked && !existing.isBlocked) {
          merged.set(localItem.hostname, localItem);
        }
      }
    }
  });
  
  return Array.from(merged.values());
}

async function syncVaultToServer() {
  try {
    if (!ACCESS_TOKEN) {
      console.log("[VaultSync] Not authenticated, skipping sync");
      return;
    }
    
    if (!await ensureMasterKey()) {
      console.log("[VaultSync] Master key not available, skipping sync");
      return;
    }

    const settings = await getSettings();
    if (!settings.syncBlocklist) {
      console.log("[VaultSync] Sync disabled in settings");
      return;
    }

    const localVault = await getVaultLocal();
    console.log("[VaultSync] Syncing", localVault.length, "items to server");

    let remoteVault: VaultItem[] = [];
    const cached = await getEncryptedVault();
    if (cached) {
      if (!MASTER_USER_KEY) {
        console.log("[VaultSync] Master key cleared during cached vault retrieval");
        return;
      }
      const decrypted = await decryptString(cached, MASTER_USER_KEY);
      remoteVault = JSON.parse(decrypted);
    } else {
      const remote = await getVault();
      if (!MASTER_USER_KEY) {
        console.log("[VaultSync] Master key cleared during remote vault retrieval");
        return;
      }
      if (remote) {
        const decrypted = await decryptString(remote, MASTER_USER_KEY);
        remoteVault = JSON.parse(decrypted);
      }
    }

    const merged = mergeVaultItems(localVault, remoteVault);
    console.log("[VaultSync] Merged vault contains", merged.length, "items");

    const encrypted = await encryptString(JSON.stringify(merged), MASTER_USER_KEY);
    await updateVault(encrypted);
    await storeEncryptedVault(encrypted);
    
    await saveVaultLocal(merged);
    await updateBlockingRules();
    
    console.log("[VaultSync] ✓ Successfully synced to server");
  } catch (error) {
    console.error("[VaultSync]  Failed to sync:", error);
  }
}

async function syncVaultFromServer() {
  try {
    if (!ACCESS_TOKEN) {
      console.log("[VaultSync] Not authenticated, skipping fetch");
      return;
    }
    
    if (!await ensureMasterKey()) {
      console.log("[VaultSync] Master key not available, skipping fetch");
      return;
    }

    const settings = await getSettings();
    if (!settings.syncBlocklist) {
      console.log("[VaultSync] Sync disabled in settings");
      return;
    }

    console.log("[VaultSync] Fetching vault data from server...");
    const remoteEncrypted = await getVault();
    
    if (!remoteEncrypted) {
      console.log("[VaultSync] No remote vault data found");
      return;
    }

    const decrypted = await decryptString(remoteEncrypted, MASTER_USER_KEY);
    const remoteVault: VaultItem[] = JSON.parse(decrypted);
    console.log("[VaultSync] Retrieved", remoteVault.length, "items from server");
    const localVault = await getVaultLocal();
    
    const merged = mergeVaultItems(localVault, remoteVault);
    console.log("[VaultSync] Merged contains", merged.length, "items");

    await saveVaultLocal(merged);
    await updateBlockingRules();
    await storeEncryptedVault(remoteEncrypted);
    
    console.log("[VaultSync] ✓ Successfully synced from server");
  } catch (error) {
    console.error("[VaultSync]  Failed to fetch:", error);
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

const getHostname = (urlString: string): string => {
  try {
    const urlObj = new URL(urlString);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return urlString.replace(/^www\./, '');
  }
};

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

async function getVaultLocal(): Promise<VaultItem[]> {
  try {
    if (ACCESS_TOKEN) {
      const settings = await getSettings();
      if (settings.syncBlocklist) {
        if (await ensureMasterKey()) {
          await migrateOldStorageFormat();
          return await getVaultLocalEncrypted(MASTER_USER_KEY!);
        }
      }
    }
    const result = await chrome.storage.local.get("vault_local");
    return result.vault_local || [];
  } catch (err) {
    console.error("[VaultLocal] Error reading:", err);
    return [];
  }
}

async function saveVaultLocal(items: VaultItem[]) {
  try {
    if (ACCESS_TOKEN) {
      const settings = await getSettings();
      if (settings.syncBlocklist) {
        if (await ensureMasterKey()) {
          await saveVaultLocalEncrypted(items, MASTER_USER_KEY!);
          return;
        }
      }
    }
    await chrome.storage.local.set({ vault_local: items });
  } catch (err) {
    console.error("[VaultLocal] Error saving:", err);
  }
}

async function migrateOldStorageFormat() {
  try {
    const [plainBlocklist, plainHistory, encBlocklist, encHistory] = await Promise.all([
      chrome.storage.local.get("blocklist"),
      chrome.storage.local.get("history"),
      chrome.storage.local.get("blocklist_enc"),
      chrome.storage.local.get("history_enc")
    ]);

    const itemsToMigrate = new Map<string, VaultItem>();

    if (plainBlocklist.blocklist?.length > 0) {
      console.log("[Migration] Found", plainBlocklist.blocklist.length, "plain blocklist items");
      plainBlocklist.blocklist.forEach((item: any) => {
        itemsToMigrate.set(item.hostname, convertOldToNewFormat(item));
      });
    }

    if (plainHistory.history?.length > 0) {
      console.log("[Migration] Found", plainHistory.history.length, "plain history items");
      plainHistory.history.forEach((item: any) => {
        const existing = itemsToMigrate.get(item.hostname);
        const converted = convertOldToNewFormat(item);
        if (existing) {
          if (converted.lastChecked > existing.lastChecked) {
            existing.lastChecked = converted.lastChecked;
            existing.prediction = converted.prediction;
            existing.confidence = converted.confidence;
          }
        } else {
          itemsToMigrate.set(item.hostname, converted);
        }
      });
    }

    if (encBlocklist.blocklist_enc && await ensureMasterKey()) {
      try {
        const decrypted = await decryptString(encBlocklist.blocklist_enc, MASTER_USER_KEY!);
        const items = JSON.parse(decrypted);
        console.log("[Migration] Found", items.length, "encrypted blocklist items");
        items.forEach((item: any) => {
          itemsToMigrate.set(item.hostname, convertOldToNewFormat(item));
        });
      } catch (err) {
        console.error("[Migration] Error decrypting old blocklist:", err);
      }
    }

    if (encHistory.history_enc && await ensureMasterKey()) {
      try {
        const decrypted = await decryptString(encHistory.history_enc, MASTER_USER_KEY!);
        const items = JSON.parse(decrypted);
        console.log("[Migration] Found", items.length, "encrypted history items");
        items.forEach((item: any) => {
          const existing = itemsToMigrate.get(item.hostname);
          const converted = convertOldToNewFormat(item);
          if (existing) {
            if (converted.lastChecked > existing.lastChecked) {
              existing.lastChecked = converted.lastChecked;
              existing.prediction = converted.prediction;
              existing.confidence = converted.confidence;
            }
          } else {
            itemsToMigrate.set(item.hostname, converted);
          }
        });
      } catch (err) {
        console.error("[Migration] Error decrypting old history:", err);
      }
    }

    if (itemsToMigrate.size > 0) {
      console.log("[Migration] Migrating", itemsToMigrate.size, "items to new format");
      if (await ensureMasterKey()) {
        await saveVaultLocalEncrypted(Array.from(itemsToMigrate.values()), MASTER_USER_KEY!);
        
        await chrome.storage.local.remove(["blocklist", "history", "blocklist_enc", "history_enc"]);
        console.log("[Migration] ✓ Migration complete, old storage cleaned up");
      }
    }
  } catch (error) {
    console.error("[Migration] Failed:", error);
  }
}

function convertOldToNewFormat(oldItem: any): VaultItem {
  const lastChecked = oldItem.history?.datetime || oldItem.block?.datetime || oldItem.createdAt || new Date().toISOString();
  return {
    id: oldItem.id || crypto.randomUUID(),
    hostname: oldItem.hostname,
    createdAt: oldItem.createdAt || new Date().toISOString(),
    lastChecked,
    isBlocked: oldItem.block?.enabled || false,
    prediction: oldItem.history?.prediction,
    confidence: oldItem.history?.confidence
  };
}

async function getBlocklist(): Promise<VaultItem[]> {
  const vault = await getVaultLocal();
  return vault.filter(item => item.isBlocked);
}
async function getVaultLocalEncrypted(key: CryptoKey): Promise<VaultItem[]> {
  const result = await chrome.storage.local.get("vault_local_enc");
  if (!result.vault_local_enc) return [];
  const decrypted = await decryptString(result.vault_local_enc, key);
  return JSON.parse(decrypted);
}

async function saveVaultLocalEncrypted(items: VaultItem[], key: CryptoKey) {
  const encrypted = await encryptString(JSON.stringify(items), key);
  await chrome.storage.local.set({ vault_local_enc: encrypted });
  await chrome.storage.local.remove(["vault_local", "blocklist", "history", "blocklist_enc", "history_enc"]);
}

async function isBlocked(hostname: string): Promise<boolean> {
  const normalizedHostname = getHostname(hostname);
  const list = await getBlocklist();
  return list.some((i) => i.hostname === normalizedHostname);
}

async function addToBlocklist(hostname: string, predictionData?: { prediction: PredictionLabel, confidence: number }) {
  const normalizedHostname = getHostname(hostname);
  const vault = await getVaultLocal();
  
  const existingIndex = vault.findIndex((i) => i.hostname === normalizedHostname);
  const now = new Date().toISOString();
  
  if (existingIndex >= 0) {
    vault[existingIndex].isBlocked = true;
    vault[existingIndex].lastChecked = now;
    if (predictionData) {
      vault[existingIndex].prediction = predictionData.prediction;
      vault[existingIndex].confidence = predictionData.confidence;
    }
    console.log("[Blocklist] Updated:", normalizedHostname);
  } else {
    vault.push({
      id: crypto.randomUUID(),
      hostname: normalizedHostname,
      createdAt: now,
      lastChecked: now,
      isBlocked: true,
      prediction: predictionData?.prediction,
      confidence: predictionData?.confidence
    });
    console.log("[Blocklist] Added:", normalizedHostname);
  }

  await saveVaultLocal(vault);
  await updateBlockingRules();
  
  const settings = await getSettings();
  if (settings.syncBlocklist && ACCESS_TOKEN) {
    if (await ensureMasterKey()) {
      await syncVaultToServer();
    }
  }
}

async function removeFromBlocklist(hostname: string) {
  const normalizedHostname = getHostname(hostname);
  const vault = await getVaultLocal();
  
  const item = vault.find(i => i.hostname === normalizedHostname);
  if (item) {
    item.isBlocked = false;
    item.lastChecked = new Date().toISOString();
    console.log("[Blocklist] Unblocked:", normalizedHostname);
  }

  await saveVaultLocal(vault);
  await updateBlockingRules();
  
  const settings = await getSettings();
  if (settings.syncBlocklist && ACCESS_TOKEN) {
    if (await ensureMasterKey()) {
      console.log("[Blocklist] Syncing unblock across devices...");
      await syncVaultToServer();
    }
  }
}

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


const lastCheckedByTab = new Map<number, string>();

chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (change.status !== "complete" || !tab.url) return;
  if (!tab.url || tab.url.startsWith("chrome") || tab.url.startsWith("chrome-extension")) return;

  const settings = await getSettings();
  if (!settings.autoPredict) {
    console.log("[AutoPredict] Disabled in settings");
    return;
  }

  const hostname = getHostname(tab.url); 
  if (lastCheckedByTab.get(tabId) === hostname) return;
  lastCheckedByTab.set(tabId, hostname);

  console.log("[AutoPredict] Checking URL:", tab.url, "| Hostname:", hostname);

  if (isLocalhost(tab.url)) {
    console.log("[AutoPredict] Skipping localhost/local URL:", hostname);
    return;
  }

  setTimeout(() => {
    if (lastCheckedByTab.get(tabId) === hostname) {
      lastCheckedByTab.delete(tabId);
    }
  }, 10000);

  try {
    if (await isBlocked(hostname)) {
      console.log("[AutoPredict] URL already blocked:", hostname);
      chrome.action.setBadgeText({ text: "", tabId: tab.id });
      return;
    }

    console.log("[AutoPredict] Running prediction for:", tab.url);
    const result = await predictUrl(tab.url);
    console.log("[AutoPredict] Result:", result);

    if (settings.saveHistory) {
      const vault = await getVaultLocal();
      const existingIndex = vault.findIndex(i => i.hostname === hostname);
      const now = new Date().toISOString();
      if (existingIndex >= 0) {
        vault[existingIndex].prediction = result.prediction;
        vault[existingIndex].confidence = result.confidence;
        vault[existingIndex].lastChecked = now;
      } else {
        vault.push({
          id: crypto.randomUUID(),  
          hostname,
          createdAt: now,
          lastChecked: now,
          isBlocked: false,
          prediction: result.prediction,
          confidence: result.confidence
        });
      }
      await saveVaultLocal(vault);
    }
  

    if (result.prediction === "phishing") {
      console.log("[AutoPredict]  PHISHING DETECTED:", hostname);
      chrome.action.setBadgeText({ text: "!", tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#ff0000", tabId: tab.id });

      if (chrome.notifications) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon.png",
          title: " Aegis Warning - Phishing Detected!",
          message: `Potential phishing site detected: ${hostname}. Click to view details.`,
          priority: 2,
        });
      }

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
    console.error("[AutoPredict]  Error:", err);
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
    if (error.response?.data?.detail) {
      return error.response.data.detail;
    }
    return error.message || "Signup failed";
  }
}

async function preLogin(email: string): Promise<PreLoginResponse> {
  try {
    const response = await axios.post("/pre-login", { email });
    return response.data as PreLoginResponse;
  } catch (error: any) {
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error.message || "Pre-login failed");
  }
}

async function login(email: string, auth_hash: string) {
  try {
    const response = await axios.post("/login", { email, auth_hash });
    return response.data as LoginResponse;
  } catch (error: any) {
    if (error.response?.data?.detail) {
      return error.response.data.detail;
    }
    return error.message || "Login failed";
  }
}

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

async function getVault(): Promise<EncryptedPayload | null> {
  try {
    const response = await axios.get("/vault");
    return response.data.blob;
  } catch (error: any) {
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error.message || "Get vault failed");
  }
}

async function updateVault(vaultData: EncryptedPayload) {
  try {
    const response = await axios.post("/vault", { blob: vaultData });
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error.message || "Update vault failed");
  }
}

async function predictUrl(url: string) {
  try {
    const hostname = getHostname(url);
    console.log("[Predict] Checking:", url);

    if (isLocalhost(url)) {
      console.log("[Predict] Localhost detected - skipping prediction:", hostname);
      throw new Error("");
    }

    const { data } = await axios.post("/predict", { url });
    const prediction = normalizePredictionLabel(data.prediction);
    console.log("[Predict] Response:", data);

    const settings = await getSettings();
    console.log("[Predict] Result for", hostname, "is", prediction, "(confidence:", data.confidence, ")");

    if (prediction === "phishing") {
      if (settings.autoBlock) {
        console.log("[AutoBlock]  Auto-blocking enabled - adding to blocklist:", hostname);
        await addToBlocklist(hostname, { prediction, confidence: data.confidence });
        console.log("[AutoBlock] ✓ Successfully added to blocklist:", hostname);
      } else if (settings.syncBlocklist && ACCESS_TOKEN) {
        if (await ensureMasterKey()) {
          console.log("[VaultSync] Updating vault with phishing detection:", hostname);
          await updateVaultWithPrediction(hostname, prediction, data.confidence);
        }
      } else {
        console.log("[AutoBlock] Auto-blocking disabled in settings");
      }
    } else if (settings.syncBlocklist && settings.saveHistory && ACCESS_TOKEN) {
      if (await ensureMasterKey()) {
        console.log("[VaultSync] Updating vault with safe URL history:", hostname);
        await updateVaultWithPrediction(hostname, prediction, data.confidence);
      }
    }

    return {
      ...data,
      prediction,
    };
  } catch (error: any) {
    console.error("[Predict]  Error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: url
    });
    
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error.message || "Prediction failed");
  }
}

async function updateVaultWithPrediction(hostname: string, prediction: PredictionLabel, confidence: number) {
  try {
    if (!ACCESS_TOKEN) return;
    if (!await ensureMasterKey()) return;

    const normalizedHostname = getHostname(hostname);
    const now = new Date().toISOString();
    
    let vaultItems: VaultItem[] = [];
    const cached = await getEncryptedVault();
    if (cached) {
      if (!MASTER_USER_KEY) return;
      const decrypted = await decryptString(cached, MASTER_USER_KEY);
      vaultItems = JSON.parse(decrypted);
    } else {
      const remote = await getVault();
      if (!MASTER_USER_KEY) return;
      if (remote) {
        const decrypted = await decryptString(remote, MASTER_USER_KEY);
        vaultItems = JSON.parse(decrypted);
      }
    }

    let item = vaultItems.find(i => i.hostname === normalizedHostname);
    if (!item) {
      item = {
        id: crypto.randomUUID(),
        hostname: normalizedHostname,
        createdAt: now,
        lastChecked: now,
        isBlocked: false,
        prediction,
        confidence
      };
      vaultItems.push(item);
    } else {
      item.lastChecked = now;
      item.prediction = prediction;
      item.confidence = confidence;
    }
    const encrypted = await encryptString(JSON.stringify(vaultItems), MASTER_USER_KEY);
    await updateVault(encrypted);
    await storeEncryptedVault(encrypted);
    
    const settings = await getSettings();
    if (settings.syncBlocklist) {
      await saveVaultLocal(vaultItems);
    }
    
    console.log("[VaultSync] ✓ Updated vault with prediction for:", normalizedHostname);
  } catch (error) {
    console.error("[VaultSync] Failed to update vault with prediction:", error);
  }
}

async function getHistory(): Promise<VaultItem[]> {
  const vault = await getVaultLocal();
  return vault.filter(item => item.prediction !== undefined);
}

async function addToHistory(item: VaultItem) {
  const vault = await getVaultLocal();
  
  const existingIndex = vault.findIndex(v => v.hostname === item.hostname);
  if (existingIndex >= 0) {
    vault[existingIndex] = {
      ...vault[existingIndex],
      ...item,
      lastChecked: item.lastChecked || new Date().toISOString()
    };
  } else {
    vault.push(item);
  }
  
  const historyItems = vault.filter(v => v.prediction !== undefined);
  if (historyItems.length > 100) {
    historyItems
      .filter(v => !v.isBlocked)
      .sort((a, b) => new Date(a.lastChecked).getTime() - new Date(b.lastChecked).getTime())
      .slice(0, historyItems.length - 100)
      .forEach(old => {
        const idx = vault.findIndex(v => v.id === old.id);
        if (idx >= 0) vault.splice(idx, 1);
      });
  }
  
  await saveVaultLocal(vault);
}

async function clearHistory() {
  const vault = await getVaultLocal();
  const filtered = vault.filter(item => item.isBlocked);
  await saveVaultLocal(filtered);
}


chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  (async () => {
    await restoreSession();
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
          
          if (!oldSettings.syncBlocklist && message.payload.syncBlocklist && MASTER_USER_KEY && ACCESS_TOKEN) {
            console.log("[Settings] Sync enabled - migrating and syncing data...");
            await syncVaultToServer();
          }
          
          sendResponse({ success: true });
          break;
        }
        
        case "UPDATE_SETTING": {
          const currentSettings = await getSettings();
          const oldValue = currentSettings[message.payload.key];
          currentSettings[message.payload.key] = message.payload.value;
          await setSettings(currentSettings);
          
          if (message.payload.key === 'syncBlocklist' && !oldValue && message.payload.value && MASTER_USER_KEY && ACCESS_TOKEN) {
            console.log("[Settings] Sync enabled - migrating and syncing data...");
            await syncVaultToServer();
          }
          
          sendResponse({ success: true });
          break;
        }
             
        case "PREDICT_URL": {
          const result = await predictUrl(message.payload.url);
          
          const settings = await getSettings();
          if (settings.saveHistory && !(ACCESS_TOKEN && settings.syncBlocklist)) {
            await addToHistory({
              id: crypto.randomUUID(),
              hostname: getHostname(message.payload.url),
              createdAt: new Date().toISOString(),
              lastChecked: new Date().toISOString(),
              isBlocked: false,
              prediction: result.prediction,
              confidence: result.confidence
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

        case "GET_HISTORY": {
          const history = await getHistory();
          history.sort((a, b) => {
            return new Date(b.lastChecked).getTime() - new Date(a.lastChecked).getTime();
          });
          
          sendResponse({
            success: true,
            data: history,
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
          const auth_hash = await deriveAuthHash(message.payload.password, salt);

          const finalpayload: SignupData = {
            email: message.payload.email,
            auth_hash,
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
          let saltHex: string;
          try {
            const preLoginData = await preLogin(message.payload.email);
            saltHex = preLoginData.salt;
          } catch (err: any) {
            sendResponse({ success: false, error: err.message || "Failed to reach server" });
            break;
          }

          const loginSalt = hexToBuffer(saltHex);
          const auth_hash = await deriveAuthHash(message.payload.password, loginSalt);

          const logindata: LoginResponse | string = await login(
            message.payload.email,
            auth_hash,
          );
          if (typeof logindata !== "string") {
            await setAccessToken(logindata.access_token);
            await setRefreshToken(logindata.refresh_token);
            const derivedKey = await deriveKeyFromPassword(
              message.payload.password,
              loginSalt,
            );
            const masterKeyHex = await decryptString(
              logindata.enc_master_user,
              derivedKey,
            );
            const masterKeyBytes = hexToBuffer(masterKeyHex);
            MASTER_USER_KEY = await importMasterKey(masterKeyBytes);
            
            await storeMasterKey(MASTER_USER_KEY);
            
            const settings = await getSettings();
            if (settings.syncBlocklist) {
              console.log("[Login] Syncing vault data from server...");
              await syncVaultFromServer();
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
          await syncVaultToServer();
          sendResponse({ success: true });
          break;
        }
        
        case "SYNC_VAULT": {
          requireAuth();
          await syncVaultToServer();
          sendResponse({ success: true });
          break;
        }

        case "LOGOUT":
          await clearSession();
          await chrome.storage.local.remove(["vault_local_enc", "vault_local", "blocklist_enc", "history_enc", "blocklist", "history"]);
          await chrome.storage.session.remove("masterKeyJWK");
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


chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await chrome.storage.local.set({
      vault_local: [], // Unified vault storage
      settings: { 
        autoPredict: false, 
        autoBlock: false,
        autoPopup: false,
        saveHistory: false, 
        syncBlocklist: false 
      },
    });
    console.log("[Init] First install — storage initialized");
  }

  await updateBlockingRules();
  console.log("[Init] Extension ready");
});


chrome.runtime.onStartup.addListener(async () => {
  try {
    await restoreSession();

    if (ACCESS_TOKEN) {
      console.log("[Startup] Session restored — access token available");

      MASTER_USER_KEY = await restoreMasterKey();
      if (MASTER_USER_KEY) {
        console.log("[Startup] ✓ Master key restored - sync enabled");
        await syncVaultFromServer();
      } else {
        console.log("[Startup] Master key not available - user needs to login");
      }
    } else {
      console.log("[Startup] No active session found");
    }

    await updateBlockingRules();
    console.log("[Startup] Blocking rules restored");
  } catch (error) {
    console.error("[Startup] Error during startup:", error);
  }
});
