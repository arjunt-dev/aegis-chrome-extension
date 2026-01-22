import { useState } from "react";
import { Link } from "react-router";
import AlertBanner from "../components/AlertBanner";
import { authApi } from "../api";
import { useNavigate } from "react-router";
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [alert, setAlert] = useState<{ type: string; msg: string } | null>(null);

  const handleLogin = () => {
    if (!email || !pass)
      return setAlert({ type: "error", msg: "Email and password required." });
    authApi
      .login({email, password: pass})
      .then(() => { 
        setAlert({ type: "success", msg: "Logged in successfully!" });
        setTimeout(() => {
          navigate("/otp");
        },2000);
      })
      .catch((error) => {
        setAlert({ type: "error", msg: error instanceof Error ? error.message : "Login failed." });
      });
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
          value={pass}
          onChange={(e) => setPass(e.target.value)}
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
