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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-8 transition-all duration-300 hover:shadow-xl">
        <div className="flex flex-col items-center mb-4">
          <div className="bg-blue-100 p-3 rounded-full mb-2">
            <Lock className="text-blue-600" size={28} />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-800">
            Reset Your Password
          </h2>
          <p className="text-center text-gray-500 text-sm mt-2">
            Enter your new password below to secure your account.
          </p>
        </div>

        <form onSubmit={handlePasswordReset} className="space-y-6">
          <div className="relative">
            <label className="block text-gray-600 font-medium mb-1">
              New Password
            </label>
            <input
              type={showPasswords ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              className={`w-full p-3 border rounded-xl outline-none focus:ring-2 pr-12 transition ${
                passwordError
                  ? "border-red-500 ring-red-200"
                  : passwordValid
                  ? "border-green-500 ring-green-200"
                  : "focus:ring-blue-200"
              }`}
            />
            {password &&
              (passwordValid ? (
                <CheckCircle2
                  className="absolute right-12 top-10 text-green-500 transition-opacity"
                  size={18}
                />
              ) : (
                <XCircle
                  className="absolute right-12 top-10 text-red-500 transition-opacity"
                  size={18}
                />
              ))}
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="absolute right-3 top-9 text-gray-500 hover:text-gray-700 transition"
              aria-label="Toggle password visibility"
            >
              {showPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            {passwordError && (
              <p className="text-red-500 text-sm mt-1">{passwordError}</p>
            )}
          </div>

          <div className="relative">
            <label className="block text-gray-600 font-medium mb-1">
              Confirm Password
            </label>
            <input
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-200 pr-12"
            />
          </div>

          <div className="flex items-center justify-end text-sm text-gray-600">
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="flex items-center gap-2 text-blue-600 hover:underline transition"
            >
              {showPasswords ? (
                <>
                  <EyeOff size={16} /> Hide Passwords
                </>
              ) : (
                <>
                  <Eye size={16} /> Show Passwords
                </>
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-xl font-semibold text-white transition ${
              isLoading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-blue-200"
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