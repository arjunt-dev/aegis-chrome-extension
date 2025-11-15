import { useState } from "react";
import AlertBanner from "../components/AlertBanner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [alert, setAlert] = useState<{ type: string; msg: string } | null>(null);

  const handleLogin = () => {
    if (!email || !pass)
      return setAlert({ type: "error", msg: "Email and password required." });

    setAlert({ type: "success", msg: "Logged in successfully!" });
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
      </div>
    </>
  );
}
