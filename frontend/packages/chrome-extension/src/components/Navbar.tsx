import { AlertTriangle, Clock, LogOut, Settings, User } from "lucide-react";
import { useNavigate } from "react-router";
import IconButton from "./IconButton";
import { Link } from "react-router";
import { extensionApi } from "../api";
import { useState, useEffect, useRef } from "react";

export default function Navbar() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogoutCard, setShowLogoutCard] = useState(false);
  const navigate = useNavigate();
  const logoutCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    extensionApi.getLoginStatus().then(setIsAuthenticated);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (logoutCardRef.current && !logoutCardRef.current.contains(event.target as Node)) {
        setShowLogoutCard(false);
      }
    };

    if (showLogoutCard) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLogoutCard]);

  const handleLogout = async () => {
    try {
      await extensionApi.logout();
      setIsAuthenticated(false);
      setShowLogoutCard(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleUserIconClick = () => {
    if (isAuthenticated) {
      setShowLogoutCard(!showLogoutCard);
    } else {
      chrome.tabs.create({
        url: chrome.runtime.getURL("authentication/index.html"),
      });
    }
  };

  return (
    <div className="topbar flex-nowrap px-4">
      <Link to="/">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 glass rounded-xl"></div>
          <h1 className="text-lg md:text-xl font-bold tracking-wider">Aegis</h1>
        </div>
      </Link>

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
        <div className="relative" ref={logoutCardRef}>
          <IconButton
            icon={User}
            tooltip={isAuthenticated ? "Account" : "Login"}
            onClick={handleUserIconClick}
          />
          {isAuthenticated && showLogoutCard && (
            <div className="absolute right-0 mt-2 glass rounded-xl p-3 shadow-lg min-w-[120px] z-50">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
