import { useState } from "react";
import OtpInput from "../components/OtpInput";
import AlertBanner from "../components/AlertBanner";

export default function OtpVerify() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [alert, setAlert] = useState<{ type: string; msg: string } | null>(null);

  const handleVerify = () => {
    if (otp.join("").length !== 6)
      return setAlert({ type: "error", msg: "Enter a valid 6-digit OTP." });

    setAlert({ type: "success", msg: "OTP Verified!" });
  };

  return (
    <>
      {alert && <AlertBanner type={alert.type as any} message={alert.msg} />}
      <div className="flex flex-col gap-3 w-full my-auto">
      <OtpInput value={otp} onChange={setOtp} />

      <button className="btn btn-teal auth-button w-full mt-4" onClick={handleVerify}>
        Verify OTP
      </button>
      </div>
    </>
  );
}
