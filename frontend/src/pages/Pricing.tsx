import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Star, Zap, Trophy, Rocket, Briefcase, Gift } from "lucide-react";
import { motion } from "framer-motion";

// Local fallback (if backend is offline)
const fallbackPlans = [
  {
    name: "Starter",
    price: 640,
    duration: "14 days",
    icon: <Star className="h-6 w-6 text-primary" />,
    features: ["2 active listings", "Improved visibility", "Image uploads"],
  },
  {
    name: "Advanced",
    price: 1250,
    duration: "30 days",
    popular: true,
    icon: <Zap className="h-6 w-6 text-primary" />,
    features: [
      "Up to 6 listings",
      "Boosted visibility",
      "Homepage feature (2 days)",
    ],
  },
  {
    name: "Business",
    price: 5500,
    duration: "90 days",
    icon: <Trophy className="h-6 w-6 text-primary" />,
    features: [
      "30 listings",
      "Top-tier visibility",
      "Priority support",
      "Video uploads",
    ],
  },
  {
    name: "Standard Plus",
    price: 2500,
    duration: "45 days",
    icon: <Rocket className="h-6 w-6 text-primary" />,
    features: ["10 listings", "Featured for 5 days", "Media uploads"],
  },
  {
    name: "Enterprise",
    price: 12000,
    duration: "180 days",
    icon: <Briefcase className="h-6 w-6 text-primary" />,
    features: [
      "100 listings",
      "VIP visibility",
      "Dedicated account manager",
      "Analytics dashboard",
    ],
  },
  {
    name: "Free",
    price: 0,
    duration: "7 days",
    icon: <Gift className="h-6 w-6 text-primary" />,
    features: ["1 listing", "Basic visibility", "Expires after 7 days"],
  },
];

const Pricing: React.FC = () => {
  const navigate = useNavigate();

  const [plans, setPlans] = useState(fallbackPlans);
  const [selectedPlan, setSelectedPlan] = useState("Advanced");
  const [billingCycle, setBillingCycle] = useState("monthly"); // monthly | yearly
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);

  // Fetch plans from backend
  useEffect(() => {
    fetch("/api/plans")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPlans(data);
      })
      .catch(() => {});
  }, []);

  const calculatePrice = (price: number) => {
    let final = price;

    // yearly discount
    if (billingCycle === "yearly") {
      final = final * 12 * 0.8; // 20% off
    }

    // coupon discount
    if (discount > 0) {
      final = final - final * (discount / 100);
    }

    return Math.round(final);
  };

  const applyCoupon = async () => {
    const res = await fetch(`/api/coupons/validate?code=${coupon}`);
    const data = await res.json();

    if (data.valid) {
      setDiscount(data.discount);
      alert(`Coupon applied: ${data.discount}% off`);
    } else {
      alert("Invalid coupon code");
    }
  };

  const handleProceed = (planName: string) => {
    navigate(
      `/checkout?plan=${planName.toLowerCase()}&billing=${billingCycle}&discount=${discount}`
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 py-16 px-6 md:px-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900">Choose Your Plan</h1>
          <p className="text-gray-600 mt-3">
            More listings. More visibility. More control.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center bg-white p-2 rounded-full shadow">
            <button
              className={`px-6 py-2 rounded-full ${
                billingCycle === "monthly"
                  ? "bg-primary text-white"
                  : "text-gray-700"
              }`}
              onClick={() => setBillingCycle("monthly")}
            >
              Monthly
            </button>
            <button
              className={`px-6 py-2 rounded-full ${
                billingCycle === "yearly"
                  ? "bg-primary text-white"
                  : "text-gray-700"
              }`}
              onClick={() => setBillingCycle("yearly")}
            >
              Yearly (-20%)
            </button>
          </div>
        </div>

        {/* Coupon */}
        <div className="flex justify-center mb-8 gap-2">
          <input
            type="text"
            placeholder="Enter coupon code"
            className="border p-2 rounded-lg"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
          />
          <button
            onClick={applyCoupon}
            className="bg-primary text-white px-4 py-2 rounded-lg"
          >
            Apply
          </button>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
          {plans.map((p, index) => {
            const isSelected = selectedPlan === p.name;
            const finalPrice = calculatePrice(p.price);

            return (
              <motion.div
                key={p.name}
                onClick={() => setSelectedPlan(p.name)}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.03 }}
                className={`relative cursor-pointer p-8 rounded-2xl border-2 bg-white transition-all ${
                  isSelected
                    ? "border-primary shadow-primary/40 bg-primary/5"
                    : "border-gray-200 hover:border-primary/40"
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 right-4 text-xs bg-primary px-3 py-1 rounded-full text-white">
                    Recommended
                  </div>
                )}

                {/* Icon */}
                <div className="mb-4">{p.icon}</div>

                <h3 className="text-2xl font-bold mb-1">{p.name}</h3>
                <p className="text-3xl font-bold text-primary">
                  KES {finalPrice}
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Valid for {billingCycle === "monthly" ? p.duration : "12 months"}
                </p>

                <ul className="space-y-2 mb-6">
                  {p.features.map((f: string, i: number) => (
                    <li key={i} className="flex items-center text-gray-700 text-sm">
                      <CheckCircle2 className="text-primary mr-2 h-4 w-4" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleProceed(p.name);
                  }}
                  className={`w-full py-3 rounded-lg font-semibold transition ${
                    isSelected
                      ? "bg-primary text-white"
                      : "bg-gray-800 text-white"
                  }`}
                >
                  {isSelected ? "Selected ✓" : `Choose ${p.name}`}
                </button>
              </motion.div>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Pricing;
