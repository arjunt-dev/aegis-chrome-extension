import { useEffect, useState } from "react";
import { Trash2, History, RefreshCw } from "lucide-react";

interface HistoryItem {
  url:  string;
  prediction: number;
  confidence: number;
  checkedAt: string;
  result: 'safe' | 'phishing';
}

export default function PredictionHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await sendMessage('GET_HISTORY');
      setHistory(response. data || []);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const sendMessage = (type: string, payload?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!response.success) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  };

  const clearHistory = async () => {
    if (! confirm('Are you sure you want to clear all history?')) return;
    
    try {
      await sendMessage('CLEAR_HISTORY');
      await loadHistory();
    } catch (err) {
      alert('Failed to clear history');
    }
  };

  return (
    <div className="min-h-screen w-full bg-primary text-gray-200 px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <History className="w-6 h-6 text-teal-400" /> 
          Prediction History ({history.length})
        </h1>

        <div className="flex gap-2">
          <button
            className="btn-teal px-4 py-2 text-sm rounded-lg flex items-center gap-2"
            onClick={loadHistory}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          
          <button
            className="btn-red px-4 py-2 text-sm rounded-lg flex items-center gap-2"
            onClick={clearHistory}
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-xl p-8 text-center">
          <p>Loading history...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-gray-400">
          No prediction history yet
        </div>
      ) : (
        <div className="glass rounded-xl p-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-2">Result</th>
                <th className="py-2 px-2">URL</th>
                <th className="py-2 px-2">Confidence</th>
                <th className="py-2 px-2">Date</th>
              </tr>
            </thead>

            <tbody>
              {history.map((item, index) => (
                <tr key={index} className="border-b border-gray-800">
                  <td className="py-2 px-2">
                    {item.result === 'phishing' ? (
                      <span className="text-red-400 font-semibold">⚠️ Phishing</span>
                    ) : (
                      <span className="text-green-400 font-semibold">✓ Safe</span>
                    )}
                  </td>
                  <td className="py-2 px-2 font-mono text-xs">{item.url}</td>
                  <td className="py-2 px-2">{Math.round(item.confidence * 100)}%</td>
                  <td className="py-2 px-2 text-xs">{new Date(item.checkedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}