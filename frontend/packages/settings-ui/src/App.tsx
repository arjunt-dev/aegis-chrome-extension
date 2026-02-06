import { useEffect, useState } from "react";

import "./App.css";
import ToggleSwitch from "./components/toggle";
import type { AppSettings } from "./utils/types";
import { settingsApi } from "./api";

const defaultSettings: AppSettings = {
  autoPredict: true,
  autoBlock: false,
  autoPopup: true,
  saveHistory: false,
  syncBlocklist: false,
};

function App() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Fetch settings and login state
    (async () => {
      const savedSettings = await settingsApi.getSettings(defaultSettings);
      setSettings(savedSettings);

      const loggedIn = await settingsApi.getLoginStatus();
      setIsLoggedIn(loggedIn);
    })();
  }, []);

  const handleSettingChange = async (key: keyof AppSettings, value: boolean) => {
    let newSettings = { ...settings, [key]: value };
    
    // If turning off autoPredict, also turn off autoPopup
    if (key === "autoPredict" && !value) {
      newSettings.autoPopup = false;
    }
    
    setSettings(newSettings);

    // Save all updated settings
    await settingsApi.saveSettings(newSettings);
  };

  return (
    <div className="w-full min-h-screen px-5 py-6 bg-primary text-gray-200 font-sans">

      <h1 className="text-xl font-semibold mb-4">Extension Settings</h1>

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

        <ToggleSwitch
          label="Auto-open popup on detection"
          checked={settings.autoPopup}
          onChange={(value) => handleSettingChange("autoPopup", value)}
          disabled={!settings.autoPredict}
        />

        <ToggleSwitch
          label="Save prediction history"
          checked={settings.saveHistory}
          onChange={(value) => handleSettingChange("saveHistory", value)}
        />
      </div>

      <div className="glass p-4 rounded-xl shadow-md">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Cloud Sync (Requires Login)</h2>
        </div>

        <p className="text-sm text-gray-400 mt-1 mb-4">
          {isLoggedIn
            ? "End-to-end encrypted sync with your account."
            : "Log in to sync your data securely across devices."}
        </p>

        <ToggleSwitch
          label="Sync blocklist & history across devices"
          checked={settings.syncBlocklist}
          onChange={(value) => handleSettingChange("syncBlocklist", value)}
          disabled={!isLoggedIn}
        />
      </div>
    </div>
  );
}

export default App;
