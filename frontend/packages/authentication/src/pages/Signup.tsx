import { useState } from "react";
import AlertBanner from "../components/AlertBanner";
import { authApi } from "../api";
import {generateSalt,deriveKeyFromPassword, encryptData, bufferToHex} from "../../../shared/src/mask";
import { encode } from "../../../shared/src/z85";
export default function Signup() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [alert, setAlert] = useState<{ type: string; msg: string } | null>(null);
  
  const handleSignup = async () => {
  if (!email || !pass || !confirm)
    return setAlert({ type: "error", msg: "All fields are required." });
  if (pass !== confirm)
    return setAlert({ type: "error", msg: "Passwords do not match." });
  
  try {
    const salt = await generateSalt();
    const masterKey = await deriveKeyFromPassword(pass, salt);
    const encryptedMasterKey = await encryptData(
      String(encode(new Uint8Array(await crypto.subtle.exportKey("raw", masterKey)))),
      masterKey
    );
    await authApi.signup({
      email,
      password: pass,
      confirm_password: confirm,
      encrypted_master_key: encryptedMasterKey.ciphertext,
      password_salt: bufferToHex(salt),
    });

    setAlert({ type: "success", msg: "OTP sent to your email." });
  } catch (error) {
    setAlert({ type: "error", msg: error instanceof Error ? error.message : "Signup failed." });
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
