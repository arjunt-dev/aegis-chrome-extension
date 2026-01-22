import { sendMessageToBackground } from "../../shared/src/messenger";

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