// API wrapper for authentication app
export async function sendMessageToBackground<T = any>(type: string, payload?:  any): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome. runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (! response. success) {
        reject(new Error(response.error));
      } else {
        resolve(response.data);
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
    return sendMessageToBackground('SIGNUP', data);
  },

  async login(email: string, password: string) {
    return sendMessageToBackground('LOGIN', { email, password });
  },

  async verifyOtp(data:{code:  string}) {
    return sendMessageToBackground('VERIFY_OTP', data);
  },

  async logout() {
    return sendMessageToBackground('LOGOUT');
  },
};