// API wrapper for authentication app
import {sendMessageToBackground} from '../../shared/src/messenger';

export const authApi = {
  async signup(data: {
    email: string;
    password: string;
    confirm_password: string;
    encrypted_master_key: string;
    password_salt: string;
  }) {
    return sendMessageToBackground('SIGNUP', data);
  },

  async login(data:{email: string, password: string}) {
    return sendMessageToBackground('LOGIN', { data });
  },

  async verifyOtp(data:{email: string, code:  string}) {
    return sendMessageToBackground('VERIFY_OTP', data);
  },

  async logout() {
    return sendMessageToBackground('LOGOUT');
  },

  async getAuthStatus() {
    return sendMessageToBackground('GET_AUTH_STATUS');
  }
};