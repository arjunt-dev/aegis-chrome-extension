import { useState } from "react";
import { Link } from "react-router";
import AlertBanner from "../components/AlertBanner";
import { authApi } from "../utils/api";
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [alert, setAlert] = useState<{ type: string; msg: string } | null>(null);

  const handleLogin = async () => {
    if (!email || !password)
      return setAlert({ type: "error", msg: "Email and password required." });
    const response = await authApi.login(email, password);
    if (response?.success === true) {
      setAlert({ type: "success", msg: "Logged in successfully!" });
    }
    else {
      setAlert({ type: "error", msg: response?.message || "Login failed. Please try again." });
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

        <input
          className="input-box auth-input w-full"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

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

