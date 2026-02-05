import type { AppSettings } from "./utils/types";

async function sendMessageToBackground<T = any>(type: string, payload?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response.success) {
        reject(new Error(response.error));
      } else {
        resolve(response.data);
      }
    });
  });
}

export const settingsApi = {
  async getSettings(defaults: AppSettings): Promise<AppSettings> {
    try {
      return await sendMessageToBackground<AppSettings>('GET_SETTINGS');
    } catch (error) {
      console.error('Error getting settings:', error);
      return defaults;
    }
  },

  async saveSetting(key: keyof AppSettings, value: boolean): Promise<void> {
    await sendMessageToBackground('UPDATE_SETTING', { key, value });
  },

  async getLoginStatus(): Promise<boolean> {
    try {
      const result = await sendMessageToBackground<{ isAuthenticated: boolean }>('IS_AUTHENTICATED');
      return result.isAuthenticated;
    } catch (error) {
      return false;
    }
  }
};