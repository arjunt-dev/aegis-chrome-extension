export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface User {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface BlocklistItem {
  id: number;
  encrypted_url: string;
  decrypted_url?:  string;
  url_hash:  string;
  added_at: string;
}

export interface HistoryItem {
  id: number;
  encrypted_url: string;
  decrypted_url?: string;
  url_hash: string;
  result: string;
  confidence: number;
  checked_at: string;
}

export interface PredictionResult {
  url: string;
  prediction: number;
  confidence: number;
}