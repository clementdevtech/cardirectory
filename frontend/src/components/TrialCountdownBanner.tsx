import React, { useEffect, useState } from "react";
import { differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";
import { AlertCircle } from "lucide-react";

interface TrialCountdownBannerProps {
  trialEnd: string | null; // Supabase timestamp string
  userRole?: string;
}

const TrialCountdownBanner: React.FC<TrialCountdownBannerProps> = ({ trialEnd, userRole }) => {
  const [remainingTime, setRemainingTime] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!trialEnd || userRole === "dealer") return;

    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date(trialEnd);

      if (end <= now) {
        setExpired(true);
        setRemainingTime("Trial expired");
        clearInterval(interval);
        return;
      }

      const days = differenceInDays(end, now);
      const hours = differenceInHours(end, now) % 24;
      const minutes = differenceInMinutes(end, now) % 60;

      if (days > 0) {
        setRemainingTime(`${days} day${days > 1 ? "s" : ""} left`);
      } else if (hours > 0) {
        setRemainingTime(`${hours} hour${hours > 1 ? "s" : ""} left`);
      } else {
        setRemainingTime(`${minutes} minute${minutes > 1 ? "s" : ""} left`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [trialEnd, userRole]);

  if (!trialEnd || userRole === "dealer") return null;

  return (
    <div
      className={`p-4 rounded-md shadow-md flex items-center gap-3 border transition-all ${
        expired
          ? "bg-red-100 border-red-300 text-red-700"
          : "bg-yellow-100 border-yellow-300 text-yellow-800"
      }`}
    >
      <AlertCircle className="w-5 h-5" />
      <div className="flex-1">
        {expired ? (
          <p className="font-semibold">
            ⏳ Your free trial has ended. Upgrade to continue using dealer features.
          </p>
        ) : (
          <p className="font-semibold">
            🚀 Free Trial Active — <span className="text-primary">{remainingTime}</span> remaining
          </p>
        )}
      </div>
    </div>
  );
};

export default TrialCountdownBanner;