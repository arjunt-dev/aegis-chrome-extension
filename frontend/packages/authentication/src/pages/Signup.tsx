import { useState } from "react";
import AlertBanner from "../components/AlertBanner";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [alert, setAlert] = useState<{ type: string; msg: string } | null>(null);

  const handleSignup = () => {
    if (!email || !pass || !confirm)
      return setAlert({ type: "error", msg: "All fields are required." });
    if (pass !== confirm)
      return setAlert({ type: "error", msg: "Passwords do not match." });
    
    setAlert({ type: "success", msg: "OTP sent to your email." });
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

        <input
          className="input-box auth-input w-full"
          placeholder="Confirm Password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <button className="btn btn-teal auth-button w-full mt-2" onClick={handleSignup}>
          Sign Up
        </button>
      </div>
    </>
  );
}
