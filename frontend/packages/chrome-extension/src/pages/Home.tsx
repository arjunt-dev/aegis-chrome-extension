import { useState } from "react";
import { AlertTriangle, Clock, Settings, User } from "lucide-react";
import { useNavigate } from "react-router";
import IconButton from "../components/IconButton";
import CircularProgress from "../components/CircularProgress";

export default function Home() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [prediction, setPrediction] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);
  
  return (
    <div className="min-h-screen w-full bg-primary flex flex-col items-center py-10 px-4 md:px-6">
      <div className="topbar flex-nowrap px-4 md:px-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 glass rounded-xl"></div>
          <h1 className="text-lg md:text-xl font-bold tracking-wider">Aegis</h1>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <IconButton icon={AlertTriangle} tooltip="Block List" onClick={() => navigate("/blocklist")}/>
          <IconButton icon={Clock} tooltip="Prediction History" onClick={() => navigate("/history")}/>
          <IconButton icon={Settings} tooltip="Settings" />
          <IconButton icon={User} tooltip="Account" />
        </div>
      </div>

      {/* Input Section */}
      <div className="flex flex-col items-center mt-28 md:mt-32 w-full max-w-md md:max-w-2xl">
        <input
          type="text"
          className="input-box w-full text-sm md:text-base"
          placeholder="Enter URL to analyse..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        {/* Buttons */}
        <div className="flex flex-wrap gap-4 mt-6 justify-center">
          {(
            <button
              onClick={() => setPrediction(Math.random() * 100)}
              className="btn btn-teal text-sm md:text-lg w-28 md:w-auto"
            >
              Predict
            </button>
          )}

          {(
            <button
              onClick={() => setBlocked(true)}
              className="btn btn-red text-sm md:text-lg w-28 md:w-auto"
            >
              Block
            </button>
          )}
        </div>

        {prediction !== null && (
          <div className="scale-75 md:scale-100">
            <CircularProgress value={parseFloat(prediction.toFixed(2))} />
          </div>
        )}
      </div>
    </div>
  );
}
