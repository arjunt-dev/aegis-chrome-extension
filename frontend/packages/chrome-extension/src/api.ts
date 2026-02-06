
export async function sendMessageToBackground<T = any>(type: string, payload?:  any): Promise<T> {
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

export const extensionApi = {
  async predictUrl(url: string) {
    return sendMessageToBackground('PREDICT_URL', { url });
  },
  
  async getCurrentTab() {
    const [tab] = await chrome.tabs. query({ active: true, currentWindow: true });
    return tab;
  }
  ,
  async blockUrl(url: string) {
    await sendMessageToBackground('ADD_TO_BLOCKLIST', { url });
  },
  
  async getLoginStatus(): Promise<boolean> {
    try {
      const result = await sendMessageToBackground<boolean>('IS_AUTHENTICATED');
      return result;
    } catch (error) {
      return false;
    }
  },

  async logout() {
    return sendMessageToBackground('LOGOUT');
  }
}
