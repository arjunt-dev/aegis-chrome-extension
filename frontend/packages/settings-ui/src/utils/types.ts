export interface AppSettings {
  autoPredict:  boolean;      // Auto-analyze URLs on navigation
  autoBlock: boolean;         // Auto-block high-confidence phishing sites
  saveHistory: boolean;       // Save prediction history locally
  syncBlocklist: boolean;     // Sync blocklist to cloud (requires login)
}