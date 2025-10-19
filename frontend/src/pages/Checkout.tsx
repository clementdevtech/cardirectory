import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";

// 👇 Replace this with your actual backend base URL
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

interface ApiResponse {
  success?: boolean;
  payment_link?: string;
  error?: string;
}

const Checkout: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedPlan = searchParams.get("plan") || "free";

  const [phone, setPhone] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Calculate plan price
  const amount: number =
    selectedPlan === "free"
      ? 0
      : selectedPlan === "standard"
      ? 500
      : selectedPlan === "premium"
      ? 1500
      : 0;

  // ✅ Validate Kenyan phone number format
  const validatePhoneNumber = (phoneNumber: string): boolean => {
    // Matches 07XXXXXXXX or 2547XXXXXXXX (M-Pesa / Airtel)
    const pattern = /^(?:\+?254|0)?7\d{8}$/;
    return pattern.test(phoneNumber.trim());
  };

  const handlePayment = async (): Promise<void> => {
    if (!phone) {
      toast.error("Please enter your phone number");
      return;
    }

    if (!validatePhoneNumber(phone)) {
      toast.error("Invalid phone number format. Use 07XXXXXXXX or +2547XXXXXXXX");
      return;
    }

    setLoading(true);

    try {
      // Retrieve logged-in user (from localStorage or context)
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user?.id) {
        toast.error("You must be logged in to pay");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/payments/pesapal/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          plan: selectedPlan,
          amount,
          phone,
        }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Payment failed");
      }

      toast.success("Payment initiated! Please check your phone to approve.");

      // Optional redirect (Pesapal payment link or dashboard)
      setTimeout(() => {
        if (data.payment_link) {
          window.location.href = data.payment_link;
        } else {
          navigate("/dashboard");
        }
      }, 2000);
    } catch (error: unknown) {
      console.error("Payment initiation error:", error);
      const errMsg =
        error instanceof Error ? error.message : "Payment initiation failed";
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-md px-4">
          <h1 className="text-2xl font-bold mb-2">
            Checkout — {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan
          </h1>
          <p className="text-gray-600 mb-8">
            Total Amount:{" "}
            <span className="font-semibold text-gray-900">KES {amount}</span>
          </p>

          <div className="bg-white p-6 rounded-xl shadow-md border">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Enter your mobile number (e.g. 07XXXXXXXX)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XXXXXXXX"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Processing..." : `Pay KES ${amount}`}
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;
