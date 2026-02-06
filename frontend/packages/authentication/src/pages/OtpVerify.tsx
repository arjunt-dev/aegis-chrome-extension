import { useState } from "react";
import OtpInput from "../components/OtpInput";
import AlertBanner from "../components/AlertBanner";
import { authApi } from "../utils/api";
import { useNavigate } from "react-router";
export default function OtpVerify() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [alert, setAlert] = useState<{ type: string; msg: string } | null>(null);
  const navigate = useNavigate();
  const handleVerify = async () => {
    if (otp.join("").length !== 6)
      return setAlert({ type: "error", msg: "Enter a valid 6-digit OTP." });
    const response=await authApi.verifyOtp({ code: otp.join("") });
    console.log(response);
    if (response?.success !== true) {
      return setAlert({ type: "error", msg: response?.error || "OTP verification failed. Please try again." });
    }
    setAlert({ type: "success", msg: "Account verified! You can now login." });
    setTimeout(() => {
      navigate("/login");
    }, 1500);
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
