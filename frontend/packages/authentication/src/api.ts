// API wrapper for authentication app
async function sendMessageToBackground<T = any>(type: string, payload?:  any): Promise<T> {
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
    encrypted_master_key: string;
    password_salt: string;
    recovery_codes: any[];
  }) {
    return sendMessageToBackground('SIGNUP', data);
  },

  async login(email: string, password: string) {
    return sendMessageToBackground('LOGIN', { email, password });
  },

  async verifyOtp(email: string, code:  string) {
    return sendMessageToBackground('VERIFY_OTP', { email, code });
  },

  async logout() {
    return sendMessageToBackground('LOGOUT');
  },

  async getAuthStatus() {
    return sendMessageToBackground('GET_AUTH_STATUS');
  }
};