import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
} from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import logo from "@/assets/logo.png";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordValid, setPasswordValid] = useState(false);

  const token = new URLSearchParams(location.search).get("token");

  // ✅ Password validation
  const validatePassword = (value) =>
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(value);

  // ✅ Live validation feedback
  useEffect(() => {
    if (!password) {
      setPasswordError("");
      setPasswordValid(false);
    } else if (!validatePassword(password)) {
      setPasswordError(
        "Password must be at least 8 characters and include a letter, number, and symbol."
      );
      setPasswordValid(false);
    } else {
      setPasswordError("");
      setPasswordValid(true);
    }
  }, [password]);

  const handlePasswordReset = async (e) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast.error("Please fill in both fields.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!passwordValid) {
      toast.error("Please use a stronger password.");
      return;
    }

    if (!token) {
      toast.error("Invalid or missing reset token.");
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
        token,
        newPassword: password,
      });

      setIsLoading(false);

      if (response.data.success) {
        toast.success("Password updated successfully!");
        navigate("/login");
      } else {
        toast.error(response.data.error || "Password reset failed.");
      }
    } catch (err) {
      console.error("ResetPassword error:", err);
      setIsLoading(false);
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-8 space-y-6 transition-all duration-300 hover:shadow-red-100">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center space-x-2 mb-3">
            <img
              src={logo}
              alt="CarDirectory Logo"
              className="h-10 w-10 object-contain rounded-md"
            />
            <span className="text-2xl font-bold text-gray-800">
              Car<span className="text-[#8B0000]">Directory</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#b44b3e] mb-2">
            <Lock size={20} aria-hidden="true" />
            <h2 className="text-2xl font-bold text-gray-800">
            Reset Your Password
            </h2>
          </div>
          <p className="text-center text-gray-500 text-sm mt-2">
            Enter your new password below to secure your account.
          </p>
        </div>

        <form onSubmit={handlePasswordReset} className="space-y-5 mt-4">
          <div>
            <label className="block text-gray-600 font-medium mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPasswords ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className={`w-full p-3 border rounded-xl outline-none focus:ring-2 pr-20 transition ${
                  passwordError
                    ? "border-red-500 ring-red-200"
                    : passwordValid
                    ? "border-green-500 ring-green-200"
                    : "focus:ring-[#b44b3e]"
                }`}
              />
              {password &&
                (passwordValid ? (
                  <CheckCircle2 className="absolute right-12 top-3 text-green-500" size={18} />
                ) : (
                  <XCircle className="absolute right-12 top-3 text-red-500" size={18} />
                ))}
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                aria-label="Toggle password visibility"
              >
                {showPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {passwordError && (
              <p className="text-red-500 text-sm mt-1">{passwordError}</p>
            )}
          </div>

          <div>
            <label className="block text-gray-600 font-medium mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-[#b44b3e] pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                aria-label="Toggle password visibility"
              >
                {showPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-xl font-semibold text-white transition ${
              isLoading
                ? "bg-[#b44b3e] opacity-70 cursor-not-allowed"
                : "bg-[#b44b3e] hover:bg-[#8B0000] shadow-md hover:shadow-red-200"
            }`}
          >
            {isLoading ? (
              <Loader2 className="animate-spin mx-auto text-white" />
            ) : (
              "Update Password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;