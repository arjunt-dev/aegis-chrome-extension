import { AlertTriangle, Clock, Settings, User } from "lucide-react";
import { useNavigate } from "react-router";
import IconButton from "./IconButton";
import { Link } from "react-router";
export default function Navbar() {
  const navigate = useNavigate();

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
        <IconButton
          icon={User}
          tooltip="Account"
          onClick={() =>
            chrome.tabs.create({
              url: chrome.runtime.getURL("authentication/index.html"),
            })
          }
        />
      </div>
    </div>
  );
}
