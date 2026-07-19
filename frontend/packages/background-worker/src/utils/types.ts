import { Url } from "url";

export type PredictionLabel = 'Safe' | 'Suspicious' | 'Phishing' | 'Unknown';
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PredictionResult {
  prediction: PredictionLabel;
  confidence: number;
}

export interface AppSettings {
  autoPredict: boolean;
  autoBlock: boolean;
  autoPopup: boolean;
  saveHistory: boolean;
  syncBlocklist: boolean;
}

export interface VaultItem {
  id: string;
  hostname: string;
  createdAt: string;
  lastChecked: string;
  isBlocked: boolean;
  prediction?: PredictionLabel;
  confidence?: number;
}

export interface EncryptedPayload {
  iv: string;
  ciphertext: string;
  v: number;
}
export interface SignupData {
  email: string;
  auth_hash: string;
  salt: string;
  enc_master_user_key: EncryptedPayload;
}

export interface PreLoginResponse {
  salt: string;
}

export interface BlockItem {
  hostname: string;
  blockedAt: string;
}

export interface LoginResponse{
  access_token: string;
  refresh_token: string;
  token_type: string;
  salt: string;
  enc_master_user: EncryptedPayload;
}