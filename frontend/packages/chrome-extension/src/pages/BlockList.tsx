import { useEffect, useState } from "react";
import { Trash2, ShieldAlert, RefreshCw } from "lucide-react";
import Navbar from "../components/Navbar";
import IconButton from "../components/IconButton";

interface BlockItem {
  url: string;
  blockedAt: string;
  confidence?:  number;
}

export default function BlockList() {
  const [list, setList] = useState<BlockItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBlocklist = async () => {
    setLoading(true);
    try {
      const response = await sendMessage('GET_BLOCKLIST');
      setList(response.data || []);
    } catch (err) {
      console.error('Error loading blocklist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlocklist();
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

  const handleUnblock = async (url: string) => {
    try {
      await sendMessage('UNBLOCK_URL', { url });
      await loadBlocklist(); // Reload list
    } catch (err) {
      alert('Failed to unblock URL');
    }
  };

  return (
    <div className="min-h-screen w-full bg-primary text-gray-200 px-4 py-6">
      <Navbar />
      <div className="flex items-center justify-between mb-4 mt-6">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-red-400" /> 
          Blocked URLs ({list.length})
        </h1>

        <IconButton
          icon={RefreshCw}
          tooltip="Refresh"
          onClick={loadBlocklist}
        />
      </div>

      {loading ?  (
        <div className="glass rounded-xl p-8 text-center">
          <p>Loading blocklist...</p>
        </div>
      ) : list.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-gray-400">
          No blocked URLs yet
        </div>
      ) : (
        <ul className="glass rounded-xl p-4">
          {list.map((item, index) => (
            <li
              key={index}
              className="flex justify-between items-center py-3 border-b border-gray-700 last:border-0"
            >
              <div className="flex-1">
                <p className="text-sm md:text-base font-mono">{item.url}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Blocked:  {new Date(item.blockedAt).toLocaleString()}
                  {item.confidence && ` • Confidence: ${Math.round(item.confidence * 100)}%`}
                </p>
              </div>

              <IconButton
                icon={Trash2}
                tooltip="Unblock"
                onClick={() => handleUnblock(item.url)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}