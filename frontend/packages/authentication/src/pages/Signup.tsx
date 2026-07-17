import { useState, useMemo } from "react";
import { Eye, EyeOff } from "lucide-react";
import AlertBanner from "../components/AlertBanner";
import { authApi } from "../utils/api";
import { useNavigate } from "react-router";

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm_password, setConfirmpassword] = useState("");
  const [alert, setAlert] = useState<{ type: string; msg: string } | null>(null);
  const [showRequirements, setShowRequirements] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const requirements: PasswordRequirement[] = [
    { label: "At least 8 characters", test: (pwd) => pwd.length >= 8 },
    { label: "No spaces", test: (pwd) => !/\s/.test(pwd) },
    { label: "One uppercase letter", test: (pwd) => /[A-Z]/.test(pwd) },
    { label: "One lowercase letter", test: (pwd) => /[a-z]/.test(pwd) },
    { label: "One digit", test: (pwd) => /[0-9]/.test(pwd) },
    { label: "One special character", test: (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd) },
  ];

  const passwordValidation = useMemo(() => {
    return requirements.map((req) => ({
      ...req,
      met: req.test(password),
    }));
  }, [password]);
const handleSignup = async () => {
  if (!email || !password || !confirm_password)
    return setAlert({ type: "warning", msg: "All fields are required." });

  if (!isValidEmail(email))
    return setAlert({ type: "warning", msg: "Please enter a valid email address." });

  // Enforce all password requirements client-side (backend no longer validates these)
  const failedReqs = passwordValidation.filter((r) => !r.met);
  if (failedReqs.length > 0) {
    setShowRequirements(true);
    return setAlert({
      type: "warning",
      msg: `Password must meet: ${failedReqs.map((r) => r.label.toLowerCase()).join(", ")}.`,
    });
  }

  if (password !== confirm_password)
    return setAlert({ type: "warning", msg: "Passwords do not match." });

  const response = await authApi.signup({ email, password, confirm_password });
  console.log(response);
  
  if (response?.success === true) {
    setAlert({ type: "success", msg: "Signed up successfully! Please check your email for OTP verification." });
    setTimeout(() => {
      navigate("/otp"); 
    }, 2000); 
  } else {
    console.log(response);
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

        <div className="relative">
          <input
            className="input-box auth-input w-full pr-10"
            placeholder="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setShowRequirements(true)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {showRequirements && password && (
          <div className="glass p-3 rounded-lg text-xs space-y-1.5">
            <p className="text-gray-300 font-medium mb-2">Password Requirements:</p>
            {passwordValidation.map((req, index) => (
              <div key={index} className="flex items-center gap-2">
                {req.met ? (
                  <span className="text-green-400 text-base">✓</span>
                ) : (
                  <span className="text-gray-500 text-base">○</span>
                )}
                <span className={req.met ? "text-green-400" : "text-gray-400"}>
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          <input
            className="input-box auth-input w-full pr-10"
            placeholder="Confirm Password"
            type={showConfirmPassword ? "text" : "password"}
            value={confirm_password}
            onChange={(e) => setConfirmpassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <button className="btn btn-teal auth-button w-full mt-2" onClick={handleSignup}>
          Sign Up
        </button>
      </div>
    </>
  );
}
