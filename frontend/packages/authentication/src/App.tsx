import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import AuthCard from "./layouts/AuthCard";
import SignIn from "./pages/Login";
import SignUp from "./pages/Signup";
import OtpVerify from "./pages/OtpVerify";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthCard />}>
          <Route index element={<Navigate to="login" replace />} />
          <Route path="login" element={<SignIn />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="otp" element={<OtpVerify />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
