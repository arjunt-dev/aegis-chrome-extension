import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link } from "react-router";
import AlertBanner from "../components/AlertBanner";
import { authApi } from "../utils/api";
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [alert, setAlert] = useState<{ type: string; msg: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    if (!email || !password)
      return setAlert({ type: "warning", msg: "Email and password required." });
    if (!isValidEmail(email))
      return setAlert({ type: "warning", msg: "Please enter a valid email address." });
    const response = await authApi.login(email, password);
    console.log(response);
    if (response?.success === true) {
      setAlert({ type: "success", msg: "Login successful! This tab will close automatically..." });
      setTimeout(() => {
        window.close();
      }, 1500);
    }
    else {
      setAlert({ type: "error", msg: response?.error || "Login failed. Please try again." });
    }
  };

  return (
    <>
      {alert && <AlertBanner type={alert.type as any} message={alert.msg} />}

      <div className="flex flex-col gap-3 w-full">
        <input
          className="input-box auth-input w-full"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="relative">
          <input
            className="input-box auth-input w-full pr-10"
            placeholder="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <button className="btn btn-teal auth-button w-full mt-2" onClick={handleLogin}>
          Login
        </button>

        <p className="text-center text-sm text-gray-400 mt-3">
          Don't have an account?{" "}
          <Link to="/signup" className="text-teal-400 hover:text-teal-300 font-medium">
            Sign up
          </Link>
        </p>
      </div>
      
    </>
  );
}

