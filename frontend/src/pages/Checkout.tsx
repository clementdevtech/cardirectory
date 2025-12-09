import React, { useState, useEffect } from "react";
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
  const { user } = useAuth();

  const selectedPlan = searchParams.get("plan") || "free";
  const billing = searchParams.get("billing") || "monthly";
  const discount = Number(searchParams.get("discount") || 0);
  const baseAmount = Number(searchParams.get("amount") || 0);

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // --------------------------------------------------------------------------
  // 🎯 PRICE CALCULATOR (Dynamic)
  // --------------------------------------------------------------------------
  const calculateFinalAmount = () => {
    let price = baseAmount;

    // Apply yearly billing (20% off)
    if (billing === "yearly") {
      price = price * 12 * 0.8;
    }

    // Apply coupon discount
    if (discount > 0) {
      price = price - price * (discount / 100);
    }

    return Math.round(price);
  };

  const amount = selectedPlan === "free" ? 0 : calculateFinalAmount();

  // --------------------------------------------------------------------------
  // 📞 Kenyan Phone Validation
  // --------------------------------------------------------------------------
  const validatePhoneNumber = (phoneNumber: string): boolean => {
    const pattern = /^(?:\+?254|0)?7\d{8}$/;
    return pattern.test(phoneNumber.trim());
  };

  // --------------------------------------------------------------------------
  // 🎁 Free Trial activate logic
  // --------------------------------------------------------------------------
  const handleFreeTrial = async (user: { id: string; email: string }) => {
    try {
      const now = new Date();

      const { data: existingUser, error: fetchError } = await supabase
        .from("users")
        .select("trial_end, role")
        .eq("id", user.id)
        .single();

      if (fetchError) throw fetchError;

      const trialEnd = existingUser?.trial_end ? new Date(existingUser.trial_end) : null;

      // Active trial check
      if (trialEnd && trialEnd > now) {
        const daysLeft = Math.ceil(
          (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        toast.info(`You already have a trial (${daysLeft} days left).`);
        navigate("/dealer");
        return;
      }

      // Already dealer
      if (existingUser?.role === "dealer") {
        toast.info("You’re already a dealer.");
        navigate("/dealer");
        return;
      }

      // Activate trial
      const res = await fetch(`${API_BASE_URL}/payments/activate-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, email: user.email }),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || "Could not activate trial");
        return;
      }

      toast.success("🎉 Your free trial has started!");
      navigate("/dealer");
    } catch (err) {
      console.error("Trial error:", err);
      toast.error("Something went wrong starting your trial.");
    }
  };

  // --------------------------------------------------------------------------
  // 💳 Paid Payment Handler
  // --------------------------------------------------------------------------
  const handlePayment = async () => {
    if (!user) {
      toast.error("You must be logged in to continue.");
      return;
    }

    // Free plan
    if (selectedPlan === "free") {
      setLoading(true);
      await handleFreeTrial({ id: user.id, email: user.email });
      setLoading(false);
      return;
    }

    // Validate phone
    if (!phone) {
      toast.error("Enter your phone number.");
      return;
    }

    if (!validatePhoneNumber(phone)) {
      toast.error("Invalid phone. Use 07XXXXXXXX or +2547XXXXXXXX.");
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
          billing,
          discount,
          amount,
          phone,
        }),
      });

      const data: ApiResponse = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment failed");

      toast.success("Check your phone to approve payment…");

      setTimeout(async () => {
        // 🔗 Redirect to Pesapal hosted checkout
        if (data.payment_link) {
          window.location.href = data.payment_link;
          return;
        }

        // 🚘 Save pending car if exists
        const pendingCar = localStorage.getItem("pendingCar");

        if (pendingCar) {
          const car = JSON.parse(pendingCar);

          const saveResponse = await fetch(
            `${API_BASE_URL}/cars/submit-after-payment`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: user.id,
                ...car,
                plan: selectedPlan,
                billing,
              }),
            }
          );

          const result = await saveResponse.json();
          if (result.success) {
            toast.success("🚗 Your vehicle is now live!");
            localStorage.removeItem("pendingCar");
            navigate("/dealer");
          } else {
            toast.error(result.error || "Could not save vehicle.");
          }
        } else {
          navigate("/dealer");
        }
      }, 1500);
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(
        error instanceof Error ? error.message : "Payment initiation failed"
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-md px-4">
          <h1 className="text-2xl font-bold mb-2">
            Checkout — {selectedPlan.toUpperCase()}
          </h1>

          <p className="text-gray-600 mb-8">
            Total Amount:{" "}
            <span className="font-semibold text-gray-900">
              {selectedPlan === "free"
                ? "Free Trial (7 days)"
                : `KES ${amount}`}
            </span>
            {discount > 0 && (
              <span className="text-green-600 text-sm ml-2">
                (-{discount}% coupon)
              </span>
            )}
            {billing === "yearly" && selectedPlan !== "free" && (
              <span className="text-blue-600 text-sm ml-2">
                (Yearly billing discount applied)
              </span>
            )}
          </p>

          <div className="bg-white p-6 rounded-xl shadow-md border">
            {selectedPlan !== "free" && (
              <>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Mobile Number (e.g. 07XXXXXXXX)
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