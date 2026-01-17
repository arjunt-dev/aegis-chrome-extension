import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Navbar from "../components/Navbar";
import CircularProgress from "../components/CircularProgress";

export default function Home() {
  const [url, setUrl] = useState("");
  const [prediction, setPrediction] = useState<number | null>(null);
  const [risk, setRisk] = useState<number | null>(null); // -1: safe, 0: suspicious, 1: phishing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTabUrl, setCurrentTabUrl] = useState<string>("");
  const [isBlocked, setIsBlocked] = useState(false);

  // Get current tab URL on mount
  useEffect(() => {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (
          tab?.url &&
          !tab.url.startsWith("chrome://") &&
          !tab.url.startsWith("chrome-extension://")
        ) {
          setCurrentTabUrl(tab.url);

          // Check if current tab is already blocked
          const response = await sendMessage("CHECK_IF_BLOCKED", {
            url: tab.url,
          });
          if (response.data.isBlocked) {
            setIsBlocked(true);
          }
        }
      } catch (err) {
        console.error("Error getting current tab:", err);
      }
    })();
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

  const handlePredict = async () => {
    try {
      setLoading(true);
      setError(null);
      setPrediction(null);
      setRisk(null);
      setIsBlocked(false);

      // Use manual URL or fallback to current tab
      const urlToPredict = url.trim() || currentTabUrl;

      if (!urlToPredict) {
        setError("No URL to analyze.  Enter a URL or navigate to a website.");
        return;
      }

      // Validate URL format
      try {
        new URL(urlToPredict);
      } catch {
        setError("Invalid URL format. Please enter a valid URL.");
        return;
      }

      console.log("Predicting:", urlToPredict);
      const response = await sendMessage("PREDICT_URL", { url: urlToPredict });

      if (response.success) {
        const { prediction: pred, confidence } = response.data;
        console.log("Prediction result:", pred, confidence);
        setRisk(pred); // -1: safe, 0: suspicious, 1: phishing
        setPrediction(confidence * 100);

        // If URL was entered manually, update the input
        if (!url.trim()) {
          setUrl(urlToPredict);
        }
      }
    } catch (err: any) {
      setError(err.message || "Prediction failed");
      console.error("Prediction error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    try {
      const urlToBlock = url.trim() || currentTabUrl;

      if (!urlToBlock) {
        setError("No URL to block");
        return;
      }

      await sendMessage("ADD_TO_BLOCKLIST", { url: urlToBlock });
      setIsBlocked(true);
      alert(`Blocked:  ${urlToBlock}`);
    } catch (err: any) {
      setError(err.message || "Failed to block URL");
    }
  };

  const handleUnblock = async () => {
    try {
      const urlToUnblock = url.trim() || currentTabUrl;

      if (!urlToUnblock) {
        setError("No URL to unblock");
        return;
      }

      await sendMessage("UNBLOCK_URL", { url: urlToUnblock });
      setIsBlocked(false);
      alert(`Unblocked: ${urlToUnblock}`);
    } catch (err: any) {
      setError(err.message || "Failed to unblock URL");
    }
  };

  return (
    <div className="min-h-[500px] w-full bg-primary flex flex-col py-6 px-4">
      <Navbar />

      {/* Current Tab Indicator */}
      {currentTabUrl && (
        <div className="mt-6 glass px-4 py-2 rounded-lg text-sm text-gray-300 max-w-md w-full mx-auto">
          <span className="text-gray-400">Current Tab: </span>
          <span className="ml-2 font-mono text-xs truncate block">
            {currentTabUrl}
          </span>
        </div>
      )}

      {/* Input Section */}
      <div className="flex flex-col items-center my-8 w-full max-w-md mx-auto">
        <input
          type="text"
          className="input-box w-full text-sm"
          placeholder={
            currentTabUrl
              ? "Enter URL or use current tab..."
              : "Enter URL to analyze..."
          }
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
        />

        {/* Error Message */}
        {error && (
          <div className="mt-4 glass px-4 py-2 rounded-lg text-sm text-red-400 w-full">
            ⚠️ {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 mt-6 justify-center">
          <button
            onClick={handlePredict}
            disabled={loading}
            className="btn btn-teal flex-1 max-w-[160px] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing
              </>
            ) : (
              "Predict"
            )}
          </button>

          {isBlocked ? (
            <button
              onClick={handleUnblock}
              disabled={loading}
              className="btn btn-teal flex-1 max-w-[160px]"
            >
              Unblock
            </button>
          ) : (
            <button
              onClick={handleBlock}
              disabled={loading || (!url.trim() && !currentTabUrl)}
              className="btn btn-red flex-1 max-w-[160px]"
            >
              Block
            </button>
          )}
        </div>

        {prediction && risk && !loading && (
          <div className="mt-8">
            <CircularProgress value={parseFloat(prediction.toFixed(2))} />
            <div className="text-center mt-4">
              {risk === 1 ? (
                <p className="text-red-400 text-lg font-semibold">
                  ⚠️ Phishing
                </p>
              ) : risk === 0 ? (
                <p className="text-yellow-400 text-lg font-semibold">
                  ⚠️ Suspicious
                </p>
              ) : (
                <p className="text-green-400 text-lg font-semibold">✓ Safe</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
