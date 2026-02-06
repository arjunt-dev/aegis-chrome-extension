import { Url } from "url";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PredictionResult {
  prediction: number;
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
  block: { enabled: boolean; datetime: string | null } | null;
  history: { 
    enabled: boolean; 
    datetime: string | null;
    prediction?: number; // ADD: store prediction result
    confidence?: number; // ADD: store confidence
  } | null;
}

export interface EncryptedPayload {
  iv: string;
  ciphertext: string;
  v: number;
}
export interface SignupData {
  email: string;
  password: string;
  confirm_password: string;
  salt: string;
  enc_master_user_key: EncryptedPayload;
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