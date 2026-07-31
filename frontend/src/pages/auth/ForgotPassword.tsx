import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Loader2, MailCheck, MailWarning } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL; // Example: http://localhost:5000/api

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [isSent, setIsSent] = useState(false);

  // ✅ Simple email validation
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ✅ Handle password reset
  const handleReset = async (e) => {
    e.preventDefault();
    setEmailError("");

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    try {
      setIsLoading(true);

      // 🔥 Call your backend route (not Supabase)
      const res = await axios.post(`${API_BASE_URL}/auth/forgot-password`, {
        email,
      });

      if (res.data.success) {
        setIsSent(true);
        toast.success("Password reset email sent! Check your inbox.");
      } else {
        toast.error(res.data.error || "Failed to send reset link.");
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      toast.error(
        err.response?.data?.error || "Unexpected error. Please try again later."
      );
    } finally {
      setIsLoading(false);
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
          <h2 className="text-2xl font-bold text-gray-800">
          Forgot Password
          </h2>
        <p className="text-center text-gray-600 text-sm">
          Enter your email and we’ll send you a reset link.
        </p>
        </div>

        <form onSubmit={handleReset} className="space-y-5 mt-4">
          <div className="relative">
            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full p-3 border rounded-xl outline-none focus:ring-2 transition-all pr-12 ${
                emailError
                  ? "border-red-500 ring-red-200"
                  : "focus:ring-[#b44b3e]"
              }`}
              disabled={isSent}
              required
            />
            {isSent ? (
              <MailCheck
                size={20}
                className="absolute right-3 top-3 text-green-500"
              />
            ) : emailError ? (
              <MailWarning
                size={20}
                className="absolute right-3 top-3 text-red-500"
              />
            ) : null}
            {emailError && (
              <p className="text-red-500 text-sm mt-1">{emailError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || isSent}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-200 shadow-md ${
              isLoading || isSent
                ? "bg-[#b44b3e] opacity-70 cursor-not-allowed"
                  : "bg-[#b44b3e] hover:bg-[#8B0000] shadow-md hover:shadow-red-200"
            }`}
          >
            {isLoading ? (
              <Loader2 className="animate-spin mx-auto text-white" />
            ) : isSent ? (
              "Email Sent"
            ) : (
              "Send Reset Link"
            )}
          </button>

          {isSent && (
              <p className="text-sm text-center text-gray-600">
              Didn’t receive it? Check your spam folder or try again later.
            </p>
          )}
        </form>

        <div className="text-center">
          <p className="text-gray-600 text-sm">
            Remembered your password?{" "}
            <Link
              to="/login"
              className="text-[#b44b3e] hover:underline font-semibold"
            >
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
