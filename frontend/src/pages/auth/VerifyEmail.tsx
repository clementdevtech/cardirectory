import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

const VerifyEmail = () => {
  const { verifyEmailStatus } = useAuth();
  const [message, setMessage] = useState("Verifying your email...");
  const [email, setEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search); // ✅ Corrected
    const token = params.get("token"); // ✅ matches backend
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
        setMessage("⏳ Email not verified yet. Please check your inbox.");
      }
    });
  }, []);

  const resendVerificationEmail = async () => {
    if (!email) {
      toast.error("No email found. Please register again.");
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
        toast.success("Verification email resent! Check your inbox.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
      <p className="text-xl font-semibold mb-4">{message}</p>

      {message.includes("not verified") && (
        <button
          onClick={resendVerificationEmail}
          disabled={isResending}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {isResending ? "Resending..." : "Resend Verification Email"}
        </button>
      )}

      <Link
        to="/login"
        className="mt-4 text-blue-600 underline hover:text-blue-800 transition"
      >
        Go to Login
      </Link>
    </div>
  );
};

export default VerifyEmail;
