import { useState, useEffect } from "react";
import { AlertTriangle, Clock, Settings, User, Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import IconButton from "../components/IconButton";
import CircularProgress from "../components/CircularProgress";

export default function Home() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [prediction, setPrediction] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTabUrl, setCurrentTabUrl] = useState<string>("");
  const [isBlocked, setIsBlocked] = useState(false);

  // Get current tab URL on mount
  useEffect(() => {
    (async () => {
      try {
        const [tab] = await chrome.tabs. query({ active: true, currentWindow: true });
        if (tab?. url && 
            ! tab.url.startsWith('chrome://') && 
            !tab.url.startsWith('chrome-extension://')) {
          setCurrentTabUrl(tab.url);
          
          // Check if current tab is already blocked
          const response = await sendMessage('CHECK_IF_BLOCKED', { url: tab.url });
          if (response.data.isBlocked) {
            setIsBlocked(true);
          }
        }
      } catch (err) {
        console.error('Error getting current tab:', err);
      }
    })();
  }, []);

  const sendMessage = (type: string, payload?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      chrome.runtime. sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (! response. success) {
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
      setIsBlocked(false);
      
      // Use manual URL or fallback to current tab
      const urlToPredict = url. trim() || currentTabUrl;
      
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
      
      console.log('Predicting:', urlToPredict);
      const response = await sendMessage('PREDICT_URL', { url: urlToPredict });
      
      if (response.success) {
        const { prediction:  pred, confidence } = response.data;
        setPrediction(confidence * 100);
        
        // If URL was entered manually, update the input
        if (! url.trim()) {
          setUrl(urlToPredict);
        }
      }
    } catch (err:  any) {
      setError(err.message || 'Prediction failed');
      console.error('Prediction error:', err);
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
      
      await sendMessage('ADD_TO_BLOCKLIST', { url: urlToBlock });
      setIsBlocked(true);
      alert(`Blocked:  ${urlToBlock}`);
    } catch (err: any) {
      setError(err.message || 'Failed to block URL');
    }
  };

  const handleUnblock = async () => {
    try {
      const urlToUnblock = url.trim() || currentTabUrl;
      
      if (!urlToUnblock) {
        setError("No URL to unblock");
        return;
      }
      
      await sendMessage('UNBLOCK_URL', { url: urlToUnblock });
      setIsBlocked(false);
      alert(`Unblocked: ${urlToUnblock}`);
    } catch (err: any) {
      setError(err.message || 'Failed to unblock URL');
    }
  };

  return (
    <div className="min-h-screen w-full bg-primary flex flex-col items-center py-10 px-4 md:px-6">
      <div className="topbar flex-nowrap px-4 md:px-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 glass rounded-xl"></div>
          <h1 className="text-lg md:text-xl font-bold tracking-wider">Aegis</h1>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <IconButton 
            icon={AlertTriangle} 
            tooltip="Block List" 
            onClick={() => navigate("/blocklist")}
          />
          <IconButton 
            icon={Clock} 
            tooltip="Prediction History" 
            onClick={() => navigate("/history")}
          />
          <IconButton 
            icon={Settings} 
            tooltip="Settings" 
            onClick={() => chrome.runtime.openOptionsPage()}
          />
          <IconButton 
            icon={User} 
            tooltip="Account" 
            onClick={() => navigate("/auth")}
          />
        </div>
      </div>

      {/* Current Tab Indicator */}
      {currentTabUrl && (
        <div className="mt-6 glass px-4 py-2 rounded-lg text-sm text-gray-300 max-w-md md:max-w-2xl w-full">
          <span className="text-gray-400">Current Tab: </span> 
          <span className="ml-2 font-mono text-xs truncate block">{currentTabUrl}</span>
        </div>
      )}

      {/* Input Section */}
      <div className="flex flex-col items-center mt-8 md:mt-12 w-full max-w-md md:max-w-2xl">
        <input
          type="text"
          className="input-box w-full text-sm md:text-base"
          placeholder={currentTabUrl ? "Enter URL or leave empty to check current tab..." : "Enter URL to analyze..."}
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
        <div className="flex flex-wrap gap-4 mt-6 justify-center">
          <button
            onClick={handlePredict}
            disabled={loading}
            className="btn btn-teal text-sm md:text-lg w-32 md:w-auto flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Predict'
            )}
          </button>

          {isBlocked ?  (
            <button
              onClick={handleUnblock}
              disabled={loading}
              className="btn btn-teal text-sm md:text-lg w-32 md:w-auto"
            >
              Unblock
            </button>
          ) : (
            <button
              onClick={handleBlock}
              disabled={loading || (! url.trim() && !currentTabUrl)}
              className="btn btn-red text-sm md:text-lg w-32 md:w-auto"
            >
              Block
            </button>
          )}
        </div>

        {/* Prediction Result */}
        {prediction !== null && ! loading && (
          <div className="mt-8 scale-75 md:scale-100">
            <CircularProgress value={parseFloat(prediction.toFixed(2))} />
            <div className="text-center mt-4">
              {prediction > 70 ? (
                <p className="text-red-400 text-lg font-semibold">
                  ⚠️ High Risk of Phishing
                </p>
              ) : prediction > 40 ? (
                <p className="text-yellow-400 text-lg font-semibold">
                  ⚠️ Suspicious URL
                </p>
              ) : (
                <p className="text-green-400 text-lg font-semibold">
                  ✓ Appears Safe
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}