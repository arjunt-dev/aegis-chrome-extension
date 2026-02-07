import { useEffect, useState } from "react";
import { Trash2, History, RefreshCw } from "lucide-react";
import Navbar from "../components/Navbar";
import IconButton from "../components/IconButton";

interface HistoryItem {
  id: string;
  hostname: string;
  createdAt: string;
  lastChecked: string;
  isBlocked: boolean;
  prediction?: number;
  confidence?: number;
}

export default function PredictionHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await sendMessage('GET_HISTORY');
      setHistory(response.data || []);
      
      // Check authentication status
      const authResponse = await sendMessage('IS_AUTHENTICATED');
      setIsAuthenticated(authResponse.data || false);
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
    if (!confirm('Are you sure you want to clear all history?')) return;
    
    try {
      await sendMessage('CLEAR_HISTORY');
      await loadHistory();
    } catch (err) {
      alert('Failed to clear history');
    }
  };

  const getResultLabel = (prediction?: number) => {
    if (prediction === undefined) return 'Unknown';
    if (prediction === 1) return 'Phishing';
    if (prediction === -1) return 'Safe';
    return 'Suspicious';
  };

  const getResultColor = (prediction?: number) => {
    if (prediction === 1) return 'text-red-400';
    if (prediction === -1) return 'text-green-400';
    return 'text-yellow-400';
  };

  return (
    <div className="min-h-screen w-full bg-primary text-gray-200 px-4 py-6">
      <Navbar />
      
      <div className="flex items-center justify-between mb-4 mt-6 card-body">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <History className="w-6 h-6 text-teal-400" /> 
          Prediction History ({history.length})
        </h1>

        <div className="flex items-center gap-2">
          <IconButton
            icon={RefreshCw}
            tooltip="Refresh"
            onClick={loadHistory}
          />
          
          <IconButton
            icon={Trash2}
            tooltip="Clear All"
            onClick={clearHistory}
          />
        </div>
      </div>

      {history.length === 0 && !loading && (
        <div className="glass rounded-xl p-4 mb-4 text-sm text-gray-400">
          <p><strong>Tip:</strong> Enable "Save prediction history" in Settings to track your URL predictions.</p>
          {isAuthenticated && (
            <p className="mt-2">Enable "Sync blocklist & history" to sync across devices with encryption.</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="glass rounded-xl p-8 text-center">
          <p>Loading history...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-gray-400">
          <p>No prediction history yet</p>
          <p className="text-xs mt-2">Make some predictions to see them here</p>
        </div>
      ) : (
        <div className="glass rounded-xl p-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-2">Result</th>
                <th className="py-2 px-2">URL</th>
                <th className="py-2 px-2">Confidence</th>
                <th className="py-2 px-2">Last Checked</th>
              </tr>
            </thead>

            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-b border-gray-800">
                  <td className="py-2 px-2">
                    <span className={`font-semibold ${getResultColor(item.prediction)}`}>
                      {getResultLabel(item.prediction)}
                    </span>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs">{item.hostname}</td>
                  <td className="py-2 px-2">
                    {item.confidence !== undefined 
                      ? `${Math.round(item.confidence * 100)}%` 
                      : 'N/A'}
                  </td>
                  <td className="py-2 px-2 text-xs">
                    {new Date(item.lastChecked).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}