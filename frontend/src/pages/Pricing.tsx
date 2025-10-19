import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: 0,
    duration: "7 days",
    listings: 1,
    features: [
      "1 active listing",
      "Basic visibility in search results",
      "No media boost",
      "Expires after 7 days",
    ],
  },
  {
    name: "Standard",
    price: 500,
    duration: "30 days",
    listings: 5,
    popular: true,
    features: [
      "Up to 5 active listings",
      "Featured placement on homepage for 3 days",
      "Moderate visibility boost",
      "Includes image uploads",
      "Lasts 30 days",
    ],
  },
  {
    name: "Premium",
    price: 1500,
    duration: "60 days",
    listings: 15,
    features: [
      "Up to 15 listings",
      "Top visibility across all categories",
      "Highlight tag (Premium)",
      "Video upload support",
      "Priority customer support",
      "Lasts 60 days",
    ],
  },
];

const Pricing: React.FC = () => {
  const navigate = useNavigate();

  // Default selection = popular (Recommended) plan
  const defaultPlan = plans.find((p) => p.popular)?.name || plans[0].name;
  const [selectedPlan, setSelectedPlan] = useState(defaultPlan);

  const handleSelect = (planName: string) => {
    setSelectedPlan(planName);
  };

  const handleProceed = (planName: string) => {
    navigate(`/checkout?plan=${planName.toLowerCase()}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1">
        <section className="py-20 px-6 md:px-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900">
              Choose Your Plan
            </h1>
            <p className="text-gray-600 mt-3">
              Select the best plan for your needs — more listings, visibility, and time.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {plans.map((p) => {
              const isSelected = selectedPlan === p.name;
              return (
                <div
                  key={p.name}
                  onClick={() => handleSelect(p.name)}
                  className={`relative cursor-pointer p-8 rounded-2xl border-2 transition-all hover:scale-[1.02] ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-primary/30"
                      : "border-gray-200 bg-white hover:border-primary/50"
                  }`}
                >
                  {p.popular && (
                    <div
                      className={`absolute -top-3 right-4 text-xs font-semibold px-3 py-1 rounded-full ${
                        isSelected
                          ? "bg-primary text-white"
                          : "bg-primary/80 text-white"
                      }`}
                    >
                      Recommended
                    </div>
                  )}

                  <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    {p.name}
                  </h3>
                  <p className="text-3xl font-extrabold text-primary mb-1">
                    KES {p.price}
                  </p>
                  <p className="text-sm text-gray-500 mb-6">
                    Valid for {p.duration}
                  </p>

                  <ul className="space-y-2 mb-6">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-center text-gray-700 text-sm">
                        <CheckCircle2 className="text-primary mr-2 h-4 w-4" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // prevent reselecting card when clicking button
                      handleProceed(p.name);
                    }}
                    className={`w-full py-3 rounded-lg font-semibold transition ${
                      isSelected
                        ? "bg-primary text-white hover:bg-primary/90"
                        : "bg-gray-800 text-white hover:bg-gray-900"
                    }`}
                  >
                    {isSelected ? "Selected ✓" : `Choose ${p.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;
