import type { AppSettings } from "./types";

export async function getSettings(defaults: AppSettings): Promise<AppSettings> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting settings:', chrome.runtime.lastError);
        resolve(defaults);
      } else if (response.success) {
        resolve(response.data);
      } else {
        resolve(defaults);
      }
    });
  });
}

export async function saveSetting(key: keyof AppSettings, value: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime. sendMessage(
      { type: 'UPDATE_SETTING', payload: { key, value } },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime. lastError.message));
        } else if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error));
        }
      }
    );
  });
}

export async function getLoginStatus(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime. sendMessage({ type: 'GET_AUTH_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response.success) {
        resolve(false);
      } else {
        resolve(response.data.isAuthenticated);
      }
    });
  });
}