import { useEffect, useState } from "react";

import "./App.css";
import ToggleSwitch from "./components/toggle";
import type { AppSettings } from "./utils/types";

import { getSettings, saveSetting, getLoginStatus } from "./utils/utils";

const defaultSettings: AppSettings = {
  autoPredict: false,
  autoBlock: false,
  saveHistory: false,
  syncBlocklist: false,
};

function App() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Fetch settings and login state from utils
    (async () => {
      const savedSettings = await getSettings(defaultSettings);
      setSettings(savedSettings);

      const loggedIn = await getLoginStatus();
      setIsLoggedIn(loggedIn);
    })();
  }, []);

  const handleSettingChange = async (key: keyof AppSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Save via utils
    await saveSetting(key, value);
  };

  return (
    <div className="w-full min-h-screen px-5 py-6 bg-primary text-gray-200 font-sans">

      <h1 className="text-xl font-semibold mb-4">⚙️ Extension Settings</h1>

      <div className="glass p-4 rounded-xl mb-6 shadow-md">
        <h2 className="text-lg font-medium mb-3">General Settings</h2>

        <ToggleSwitch
          label="Auto-predict URLs"
          checked={settings.autoPredict}
          onChange={(value) => handleSettingChange("autoPredict", value)}
        />

        <ToggleSwitch
          label="Auto-block phishing sites"
          checked={settings.autoBlock}
          onChange={(value) => handleSettingChange("autoBlock", value)}
        />
      </div>

      <div className="glass p-4 rounded-xl shadow-md">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Authenticated Features</h2>
        </div>

        <p className="text-sm text-gray-400 mt-1 mb-4">
          {isLoggedIn
            ? "These settings sync with your account."
            : "Log in to unlock these features."}
        </p>

        <ToggleSwitch
          label="Save prediction history"
          checked={settings.saveHistory}
          onChange={(value) => handleSettingChange("saveHistory", value)}
          disabled={!isLoggedIn}
        />

        <ToggleSwitch
          label="Sync blocklist across devices"
          checked={settings.syncBlocklist}
          onChange={(value) => handleSettingChange("syncBlocklist", value)}
          disabled={!isLoggedIn}
        />
      </div>
    </div>
  );
}

export default App;
