// API wrapper for authentication app
export async function sendMessageToBackground<T = any>(type: string, payload?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response?.success) {
        resolve({ success: false, error: response?.error || 'Unknown error' } as T);
      } else {
        resolve({ success: true, data: response.data } as T);
      }
    });
  });
}

export const authApi = {
  async signup(data: {
    email: string;
    password: string;
    confirm_password: string;
  }) {
    try {
      return await sendMessageToBackground('SIGNUP', data);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async login(email: string, password: string) {
    try {
      return await sendMessageToBackground('LOGIN', { email, password });
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  },

  async verifyOtp(data: { code: string }) {
    try {
      return await sendMessageToBackground('VERIFY_OTP', data);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async logout() {
    try {
      return await sendMessageToBackground('LOGOUT');
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};