async function sendMessageToBackground<T = any>(type: string, payload?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime. sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response. success) {
        reject(new Error(response.error));
      } else {
        resolve(response.data);
      }
    });
  });
}

export const settingsApi = {
  async getHistory() {
    return sendMessageToBackground('GET_HISTORY');
  },

  async getBlocklist() {
    return sendMessageToBackground('GET_BLOCKLIST');
  },

  async logout() {
    return sendMessageToBackground('LOGOUT');
  }
};