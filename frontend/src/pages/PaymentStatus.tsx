import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { FaCheckCircle, FaTimesCircle, FaSpinner } from "react-icons/fa";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL as string;

export default function PaymentStatus() {
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const merchantRef = searchParams.get("merchant_reference");

  useEffect(() => {
    if (!merchantRef) {
      setStatus("failed");
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/payments/status/${merchantRef}`);
        const data = await res.json();

        console.log("Status Response:", data);

        if (data.success && data.status === "success") {
          setStatus("success");

          // ✅ Redirect after a short success display
          setTimeout(() => navigate("/dashboard"), 3000);
        } else {
          setStatus("failed");
        }
      } catch (err) {
        console.error("Status Error:", err);
        setStatus("failed");
      }
    };

    // ✅ Delay a little to allow IPN update
    setTimeout(checkStatus, 2000);
  }, [merchantRef, navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 px-6 text-center">
      
      {status === "loading" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity }}
          className="flex flex-col items-center"
        >
          <FaSpinner className="text-6xl text-blue-600 animate-spin" />
          <p className="mt-4 text-lg font-medium text-gray-700">Processing your payment...</p>
        </motion.div>
      )}

      {status === "success" && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <FaCheckCircle className="text-7xl text-green-500" />
          <h2 className="mt-4 text-3xl font-bold text-green-600">Payment Successful 🎉</h2>
          <p className="text-gray-700 mt-2">Redirecting to your dashboard...</p>
        </motion.div>
      )}

      {status === "failed" && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <FaTimesCircle className="text-7xl text-red-500" />
          <h2 className="mt-4 text-3xl font-bold text-red-600">Payment Failed ❌</h2>
          <p className="text-gray-700 mt-2">Please try again or contact support.</p>
          <button
            className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-medium hover:bg-blue-700"
            onClick={() => navigate("/pricing")}
          >
            Try Again
          </button>
        </motion.div>
      )}
    </div>
  );
}
