async function sendMessageToBackground<T = any>(type: string, payload?:  any): Promise<T> {
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

  async addToBlocklist(url: string) {
    return sendMessageToBackground('ADD_TO_BLOCKLIST', { url });
  },

  async getBlocklist() {
    return sendMessageToBackground('GET_BLOCKLIST');
  },

  async addToHistory(url: string, result: string, confidence: number) {
    return sendMessageToBackground('ADD_TO_HISTORY', { url, result, confidence });
  },

  async getCurrentTab() {
    const [tab] = await chrome.tabs. query({ active: true, currentWindow: true });
    return tab;
  }
};