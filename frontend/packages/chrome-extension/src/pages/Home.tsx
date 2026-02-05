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
  const [isBlocked, setIsBlocked] = useState(false);

  const getBaseUrl = (urlString: string): string => {
    try {
      const urlObj = new URL(urlString);
      return `${urlObj.protocol}//${urlObj.hostname}`;
    } catch {
      return urlString;
    }
  };
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
          setUrl(getBaseUrl(tab.url));

          const response = await sendMessage("CHECK_IF_BLOCKED", {
            url,
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

      const urlToPredict = url.trim();

      if (!urlToPredict) {
        setError("No URL to analyze.  Enter a URL or navigate to a website.");
        return;
      }

      try {
        new URL(urlToPredict);
      } catch {
        setError("Invalid URL format. Please enter a valid URL.");
        return;
      }

      console.log("Predicting:", urlToPredict);
      const response = await sendMessage("PREDICT_URL", {
        url: getBaseUrl(urlToPredict),
      });

      if (response.success) {
        const { prediction: pred, confidence } = response.data;
        console.log("Prediction result:", pred, confidence);
        setRisk(pred);
        setPrediction(confidence * 100);
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
      const urlToBlock = url.trim();

      if (!urlToBlock) {
        setError("No URL to block");
        return;
      }

      await sendMessage("ADD_TO_BLOCKLIST", { url: getBaseUrl(urlToBlock) });
      setIsBlocked(true);
      alert(`Blocked:  ${getBaseUrl(urlToBlock)}`);
    } catch (err: any) {
      setError(err.message || "Failed to block URL");
    }
  };

  const handleUnblock = async () => {
    try {
      const urlToUnblock = url.trim();

      if (!urlToUnblock) {
        setError("No URL to unblock");
        return;
      }

      await sendMessage("UNBLOCK_URL", { url: getBaseUrl(urlToUnblock) });
      setIsBlocked(false);
      alert(`Unblocked: ${getBaseUrl(urlToUnblock)}`);
    } catch (err: any) {
      setError(err.message || "Failed to unblock URL");
    }
  };

  return (
    <div className="min-h-[500px] w-full bg-primary flex flex-col py-6 px-4">
      <Navbar />
      <div className="flex flex-col items-center my-10 w-full max-w-md mx-auto">
        <input
          type="text"
          className="input-box w-full text-sm"
          placeholder={"Enter URL to analyze..."}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
        />
        {error && (
          <div className="mt-4 glass px-4 py-2 rounded-lg text-sm text-red-400 w-full">
            {error}
          </div>
        )}
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
              className="btn btn-yellow flex-1 max-w-[160px]"
            >
              Unblock
            </button>
          ) : (
            <button
              onClick={handleBlock}
              disabled={loading || !url.trim()}
              className="btn btn-red flex-1 max-w-[160px]"
            >
              Block
            </button>
          )}
        </div>

        {prediction !== null && risk !== null && !loading && (
          <div className="mt-8">
            <CircularProgress value={parseFloat(prediction.toFixed(2))} />
            <div className="text-center mt-4">
              {risk === 1 ? (
                <p className="text-red-400 text-lg font-semibold">Phishing</p>
              ) : risk === -1 ? (
                <p className="text-green-400 text-lg font-semibold">Safe</p>
              ) : (
                <p className="text-yellow-400 text-lg font-semibold">
                  Suspicious
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
