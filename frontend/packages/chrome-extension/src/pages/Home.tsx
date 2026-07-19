import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Navbar from "../components/Navbar";
import CircularProgress from "../components/CircularProgress";
import { extensionApi, sendMessageToBackground } from "../api";

type PredictionLabel = "Safe" | "Suspicious" | "Phishing" | "Unknown";
const PredictionLabelMap: Record<PredictionLabel, string> = {
  Safe: "text-green-400",
  Suspicious: "text-yellow-400",
  Phishing: "text-red-400",
  Unknown: "text-gray-400"
};
export default function Home() {
  const [url, setUrl] = useState("");
  const [prediction, setPrediction] = useState<number | null>(null);
  const [risk, setRisk] = useState<PredictionLabel | null>(null);
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
        // Check for URL parameters (from auto-predict)
        const params = new URLSearchParams(window.location.search);
        const autoDetected = params.get('autoDetected');
        const urlParam = params.get('url');
        const predictionParam = params.get('prediction');
        const confidenceParam = params.get('confidence');

        if (autoDetected === 'true' && urlParam && predictionParam && confidenceParam) {
          const baseUrl = getBaseUrl(urlParam);
          setUrl(baseUrl);
          setRisk(predictionParam as PredictionLabel);
          setPrediction(parseFloat(confidenceParam) * 100);
          
          // Check if already blocked
          const response = await sendMessageToBackground("CHECK_IF_BLOCKED", {
            url: baseUrl,
          });
          if (response.isBlocked) {
            setIsBlocked(true);
          }
          return; // Don't run the tab query logic
        }

        // Normal flow - get current tab
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

          const response = await sendMessageToBackground("CHECK_IF_BLOCKED", {
            url: getBaseUrl(tab.url),
          });
          if (response.isBlocked) {
            setIsBlocked(true);
          }
        }
      } catch (err) {
        console.error("Error getting current tab:", err);
      }
    })();
  }, []);

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
      const response = await extensionApi.predictUrl(getBaseUrl(urlToPredict));

      const { prediction: pred, confidence } = response;
      console.log("Prediction result:", pred, confidence);
      setRisk(pred as PredictionLabel);
      setPrediction(confidence * 100);
      if (!url.trim()) {
        setUrl(urlToPredict);
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

      await sendMessageToBackground("ADD_TO_BLOCKLIST", { url: getBaseUrl(urlToBlock) });
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

      await sendMessageToBackground("UNBLOCK_URL", { url: getBaseUrl(urlToUnblock) });
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
              <p className={`text-lg font-semibold ${PredictionLabelMap[risk]}`}>
                {risk}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
