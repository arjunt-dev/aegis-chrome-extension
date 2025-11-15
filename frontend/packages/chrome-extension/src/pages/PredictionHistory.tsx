import { useEffect, useState } from "react";
import { getHistory, type HistoryItem } from "../utils/utils";
import { Trash2, History } from "lucide-react";

export default function PredictionHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    (async () => {
      const data = await getHistory();
      setHistory(data);
    })();
  }, []);

  const clearHistory = () => {
    // TODO: implement storage clearing
    setHistory([]);
  };

  return (
    <div className="min-h-screen w-full bg-primary text-gray-200 px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <History className="w-6 h-6 text-teal-400" /> Prediction History
        </h1>

        <button
          className="btn-red px-4 py-2 text-sm rounded-lg flex items-center gap-2"
          onClick={clearHistory}
        >
          <Trash2 className="w-4 h-4" />
          Clear All
        </button>
      </div>

      <div className="glass rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-left text-sm md:text-base">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2">Sl. No</th>
              <th className="py-2">URL</th>
              <th className="py-2">Prediction Date</th>
            </tr>
          </thead>

          <tbody>
            {history.map((item, index) => (
              <tr key={index} className="border-b border-gray-800">
                <td className="py-2">{index + 1}</td>
                <td className="py-2">{item.url}</td>
                <td className="py-2">{item.predictionDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
