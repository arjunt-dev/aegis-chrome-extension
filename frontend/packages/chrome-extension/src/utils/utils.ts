export interface BlockItem {
  url: string;
  blocked: boolean;
}

export async function getBlocklist(): Promise<BlockItem[]> {
  // TODO: replace with chrome.storage logic
  return [
    { url: "http://malicious-site.com", blocked: true },
    { url: "http://phishing-example.net", blocked: false },
  ];
}

export interface HistoryItem {
  url: string;
  predictionDate: string;
}

export async function getHistory(): Promise<HistoryItem[]> {
  // TODO: replace with chrome.storage logic
  return [
    {
      url: "http://test1.com",
      predictionDate: new Date().toLocaleString(),
    },
    {
      url: "http://test2.com",
      predictionDate: new Date().toLocaleString(),
    },
  ];
}