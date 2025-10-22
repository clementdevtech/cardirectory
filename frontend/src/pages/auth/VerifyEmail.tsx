import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

const VerifyEmail = () => {
  const { verifyEmailStatus } = useAuth();
  const [message, setMessage] = useState("Verifying your email...");
  const [email, setEmail] = useState<string>("");
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const emailFromUrl = params.get("email");

    if (emailFromUrl) setEmail(emailFromUrl);

    if (!token) {
      setMessage("Invalid or missing token.");
      return;
    }

    verifyEmailStatus(token).then((verified) => {
      if (verified) {
        setMessage("✅ Email verified! You can now log in.");
      } else {
        setMessage("⏳ Email not verified yet. Please check your inbox or resend the link below.");
      }
    });
  }, []);

  // ⏱ Countdown logic
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const resendVerificationEmail = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsResending(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to resend verification email.");
      } else {
        toast.success("✅ Verification email resent! Check your inbox.");
        setCountdown(60); // start 60s cooldown
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
      <p className="text-xl font-semibold mb-4">{message}</p>

      {/* Email input section */}
      {message.includes("not verified") && (
        <div className="flex flex-col items-center space-y-3">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 px-4 py-2 rounded-lg w-64 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={resendVerificationEmail}
            disabled={isResending || countdown > 0}
            className={`bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50`}
          >
            {isResending
              ? "Resending..."
              : countdown > 0
              ? `Resend in ${countdown}s`
              : "Resend Verification Email"}
          </button>
        </div>
      )}

      <Link
        to="/login"
        className="mt-6 text-blue-600 underline hover:text-blue-800 transition"
      >
        Go to Login
      </Link>
    </div>
  );
};

export default VerifyEmail;