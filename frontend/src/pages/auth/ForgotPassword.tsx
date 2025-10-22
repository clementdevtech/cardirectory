import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Loader2, MailCheck, MailWarning } from "lucide-react";
import { Link } from "react-router-dom";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-blue-900 to-purple-900 px-4 py-10">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl w-full max-w-md p-8">
        <h2 className="text-3xl font-bold text-center text-white mb-2">
          Forgot Password
        </h2>
        <p className="text-center text-gray-300 mb-6 text-sm">
          Enter your email and we’ll send you a reset link.
        </p>

        <form onSubmit={handleReset} className="space-y-5">
          <div className="relative">
            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full p-3 bg-white/20 text-white placeholder-gray-300 border rounded-xl outline-none focus:ring-2 transition-all ${
                emailError
                  ? "border-red-400 focus:ring-red-300"
                  : "border-white/30 focus:ring-purple-400"
              }`}
              disabled={isSent}
              required
            />
            {isSent ? (
              <MailCheck
                size={20}
                className="absolute right-3 top-3 text-green-400"
              />
            ) : emailError ? (
              <MailWarning
                size={20}
                className="absolute right-3 top-3 text-red-400"
              />
            ) : null}
            {emailError && (
              <p className="text-red-400 text-sm mt-1">{emailError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || isSent}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-200 shadow-md ${
              isLoading || isSent
                ? "bg-purple-400 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 hover:shadow-lg"
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
            <p className="text-sm text-center text-gray-300">
              Didn’t receive it? Check your spam folder or try again later.
            </p>
          )}
        </form>

        <div className="text-center mt-6">
          <p className="text-gray-300 text-sm">
            Remembered your password?{" "}
            <Link
              to="/login"
              className="text-purple-300 hover:text-white underline transition-all"
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
