import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "react-toastify";
import { Loader2, MailCheck, MailWarning } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [isSent, setIsSent] = useState(false);

  // ✅ Simple email validation (no types)
  const validateEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleReset = async (e) => {
    e.preventDefault();
    setEmailError("");

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setIsLoading(false);

      if (error) {
        toast.error(error.message || "Something went wrong.");
      } else {
        setIsSent(true);
        toast.success("Password reset link sent! Check your email.");
      }
    } catch (err) {
      console.error("Reset error:", err);
      toast.error("Unexpected error. Try again later.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-8 transition-all duration-300 hover:shadow-xl">
        <h2 className="text-2xl font-extrabold text-center text-gray-800 mb-2">
          Forgot Password?
        </h2>
        <p className="text-center text-gray-600 mb-6 text-sm">
          Enter your email and we’ll send you a link to reset your password.
        </p>

        <form onSubmit={handleReset} className="space-y-5">
          <div className="relative">
            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full p-3 border rounded-xl outline-none focus:ring-2 transition-all ${
                emailError
                  ? "border-red-500 ring-red-200"
                  : "focus:ring-blue-400"
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
            className={`w-full py-3 rounded-xl font-semibold text-white transition ${
              isLoading || isSent
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-blue-200"
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
      </div>
    </div>
  );
};

export default ForgotPassword;
