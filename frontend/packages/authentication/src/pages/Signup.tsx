import { useState } from "react";
import AlertBanner from "../components/AlertBanner";
import { authApi } from "../utils/api";
import { useNavigate } from "react-router";
export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm_password, setConfirmpassword] = useState("");
  const [alert, setAlert] = useState<{ type: string; msg: string } | null>(null);
  const navigate = useNavigate();
  const handleSignup = async () => {
    if (!email || !password || !confirm_password)
      return setAlert({ type: "error", msg: "All fields are required." });
    if (password !== confirm_password)
      return setAlert({ type: "error", msg: "Passwords do not match." });
    const response = await authApi.signup({ email, password, confirm_password });
    if (response?.success === true) {
      setAlert({ type: "success", msg: "Signed up successfully! Please check your email for OTP verification." });
      setTimeout(() => {
        navigate("/verify-otp");
      }, 5000);
    } else {
      setAlert({ type: "error", msg: response?.error || "Signup failed. Please try again." });
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

        <input
          className="input-box auth-input w-full"
          placeholder="Confirm Password"
          type="password"
          value={confirm_password}
          onChange={(e) => setConfirmpassword(e.target.value)}
        />

        <button className="btn btn-teal auth-button w-full mt-2" onClick={handleSignup}>
          Sign Up
        </button>
      </div>
    </>
  );
}
