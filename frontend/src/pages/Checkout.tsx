import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL as string;

interface ApiResponse {
  success?: boolean;
  payment_link?: string;
  error?: string;
}

const Checkout: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedPlan = searchParams.get("plan") || "free";

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  //console.log(user);

  // 💰 Plan pricing
  const amount =
    selectedPlan === "free"
      ? 0
      : selectedPlan === "standard"
      ? 500
      : selectedPlan === "premium"
      ? 1500
      : 0;

  // ✅ Validate Kenyan phone number format
  const validatePhoneNumber = (phoneNumber: string): boolean => {
    const pattern = /^(?:\+?254|0)?7\d{8}$/;
    return pattern.test(phoneNumber.trim());
  };

  // 🕐 Handle Free Trial Logic (with active trial check)
const handleFreeTrial = async (user: { id: string; email: string }) => {
  try {
    // ✅ First check user status locally
    const now = new Date();
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("trial_end, role")
      .eq("id", user.id)
      .single();

    if (fetchError) throw fetchError;

    const trialEnd = existingUser?.trial_end ? new Date(existingUser.trial_end) : null;

    // ✅ If trial still active
    if (trialEnd && trialEnd > now) {
      const daysLeft = Math.ceil(
        (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      toast.info(`✅ You already have a trial (${daysLeft} days left).`);
      navigate("/dashboard");
      return;
    }

    // ✅ If already a dealer with no trial
    if (existingUser?.role === "dealer") {
      toast.info("You’re already a dealer 🎯");
      navigate("/dashboard");
      return;
    }

    // ✅ Call backend to activate trial
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE_URL}/payments/activate-trial`, {
        method: "POST",
  headers: {
    "Content-Type": "application/json",
  },

      body: JSON.stringify({ user_id: user.id, email: user.email }),
    });

    const data = await res.json();

    if (!data.success) {
      toast.error(data.error || "Could not activate trial");
      return;
    }

    toast.success("🎉 Your 7-day free trial has started!");
    navigate("/dashboard");
  } catch (err) {
    console.error("Free trial error:", err);
    toast.error("❌ Something went wrong starting your trial");
  }
};


  // 💳 Handle payment for paid plans
  const handlePayment = async (): Promise<void> => {
    if (!user) {
      toast.error("You must be logged in to continue.");
      return;
    }

    // 👉 Free plan (7-day trial)
    if (selectedPlan === "free") {
  if (!user?.id || !user?.email) {
    toast.error("User data missing. Please log in again.");
    return;
  }

  setLoading(true);
  await handleFreeTrial({ id: user.id, email: user.email });
  setLoading(false);
  return;
}


    // 👉 Paid plans (standard / premium)
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
      const response = await fetch(`${API_BASE_URL}/payments/pesapal/create`, {
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
      if (!response.ok) throw new Error(data.error || "Payment failed");

      toast.success("Payment initiated! Please check your phone to approve.");

      setTimeout(() => {
        if (data.payment_link) {
          window.location.href = data.payment_link;
        } else {
          navigate("/dashboard");
        }
      }, 1500);
    } catch (error) {
      console.error("Payment initiation error:", error);
      toast.error(error instanceof Error ? error.message : "Payment initiation failed");
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
            <span className="font-semibold text-gray-900">
              {selectedPlan === "free" ? "Free Trial (7 days)" : `KES ${amount}`}
            </span>
          </p>

          <div className="bg-white p-6 rounded-xl shadow-md border">
            {selectedPlan !== "free" && (
              <>
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
              </>
            )}

            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : selectedPlan === "free"
                ? "Start Free Trial"
                : `Pay KES ${amount}`}
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;