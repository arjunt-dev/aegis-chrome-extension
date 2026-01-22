/// <reference types="chrome"/>

const sendMessage = (type: string, payload?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, payload }, (response: { success: any; error: string | undefined; }) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!response.success) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
};

const sendMessageToBackground = <T = any>(type: string, payload?: any): Promise<T> => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, payload }, (response: { success: any; error: string | undefined; data: T }) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!response.success) {
          reject(new Error(response.error));
        } else {
          resolve(response.data);
        }
      });
    });
};

export { sendMessage, sendMessageToBackground };