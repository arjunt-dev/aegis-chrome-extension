import { useState } from "react";
import OtpInput from "../components/OtpInput";
import AlertBanner from "../components/AlertBanner";
import RecoveryCodes from "../components/RecoveryCodes";
import { authApi } from "../api";

export default function OtpVerify() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [alert, setAlert] = useState<{ type: string; msg: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [email, setEmail] = useState("");

  const handleVerify = async () => {
    if (otp.join("").length !== 6)
      return setAlert({ type: "error", msg: "Enter a valid 6-digit OTP." });
    
    try {
      const response = await authApi.verifyOtp({ email, code: otp.join("") });
      
      // Response should include recovery codes from backend
      if (response.recovery_codes) {
        setRecoveryCodes(response.recovery_codes);
        setAlert(null);
      } else {
        setAlert({ type: "success", msg: "OTP Verified!" });
      }
    } catch (error) {
      setAlert({ type: "error", msg: error instanceof Error ? error.message : "OTP verification failed." });
    }
  };

  const handleAcknowledge = () => {
    // Redirect to extension or close window
    setAlert({ type: "success", msg: "Account setup complete! You can now close this window." });
    // Optionally close window after a delay
    setTimeout(() => {
      window.close();
    }, 2000);
  };

  // Show recovery codes screen if verification was successful
  if (recoveryCodes) {
    return (
      <>
        <div className="flex flex-col gap-3 w-full">
          <h2 className="text-2xl font-bold text-center mb-2">Account Verified! 🎉</h2>
          <RecoveryCodes codes={recoveryCodes} onAcknowledge={handleAcknowledge} />
        </div>
      </>
    );
  }

  return (
    <>
      {alert && <AlertBanner type={alert.type as any} message={alert.msg} />}
      <div className="flex flex-col gap-3 w-full my-auto">
        <input
          className="input-box auth-input w-full mb-2"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        
        <OtpInput value={otp} onChange={setOtp} />

        <button className="btn btn-teal auth-button w-full mt-4" onClick={handleVerify}>
          Verify OTP
        </button>
      </div>
    </>
  );
}
