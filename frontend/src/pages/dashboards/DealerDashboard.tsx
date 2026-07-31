import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import DealerCarForm from "@/components/dealer/DealerCarForm";
import DealerAnalytics from "@/components/dealer/DealerAnalytics";
import DealerViewsOverTime from "@/components/dealer/DealerViewsOverTime";

import {
  Plus,
  Edit,
  User,
  RefreshCw,
  Bell,
  Lock,
  ArrowLeft,
} from "lucide-react";

import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
} from "date-fns";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL as string;

/* ============================
   Types
============================ */
interface Dealer {
  id: string;
  user_id: string;
  full_name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  city: string | null;
  national_id: string | null;
  tax_id: string | null;
  company_logo: string | null;
  status: "pending" | "verified" | "rejected" | "suspended";
  verified?: boolean;
  validation_message?: string | null;
}

interface UserBilling {
  is_on_trial: boolean;
  trial_end: string | null;
}

interface DealerSubscription {
  end_date: string;
  listing_limit: number;
  status: "active" | "expired" | "grace";
}


interface Listing {
  id: number;
  make: string;
  model: string;
  year: number;
  status: string;
  price?: number;
  mileage?: number;
  condition?: string;
  transmission?: string | null;
  location?: string;
  description?: string;
  phone?: string | null;
  video_url?: string | null;
  featured?: boolean;
  gallery?: string[];
}

/* ============================
   Component
============================ */
const DealerDashboard: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [dealerLookupComplete, setDealerLookupComplete] = useState(false);
  const [dealerForm, setDealerForm] = useState<Partial<Dealer>>({});
  
  const [billing, setBilling] = useState<UserBilling | null>(null);
  const [dealerSub, setDealerSub] = useState<DealerSubscription | null>(null);

  const [listings, setListings] = useState<Listing[]>([]);

  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [billingVariant, setBillingVariant] = useState<
    "default" | "warning" | "destructive"
  >("default");

  const [isCarDialogOpen, setIsCarDialogOpen] = useState(false);
  const [carStep, setCarStep] = useState(1);
  const [carForm, setCarForm] = useState<any>({
    make: "",
    model: "",
    year: "",
    mileage: "",
    condition: "used",
    transmission: "",
    description: "",
    price: "",
    location: "",
    phone: "",
  });
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [carErrors, setCarErrors] = useState<Record<string, string>>({});
  const [savingCar, setSavingCar] = useState(false);

  /* ============================
     Guard: auth + role
  ============================ */
  useEffect(() => {
    if (!isLoading && (!user || (user as any).role !== "dealer")) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  /* ============================
     Fetch data
  ============================ */
  const fetchData = useCallback(async () => {
    if (!user) return;

    setDealerLookupComplete(false);

    try {
      const { data: dealer } = await supabase
        .from("dealers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!dealer) return;

      setDealer(dealer);
      setDealerForm(dealer);

    // 🔹 User billing (trial info)
const { data: billing } = await supabase
  .from("users")
  .select("is_on_trial, trial_end")
  .eq("id", user.id)
  .single();

setBilling(billing);

// 🔹 Dealer subscription (REAL source of listing_limit)
const { data: dealerSub } = await supabase
  .from("dealer_subscriptions")
  .select("end_date, listing_limit, status")
  .eq("dealer_id", dealer.id)
  .eq("status", "active")
  .maybeSingle();

setDealerSub(dealerSub);


      const carsResponse = await fetch(`${API_BASE_URL}/dealer/cars`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
        },
        credentials: "include",
      });
      const cars = await carsResponse.json().catch(() => []);
      if (!carsResponse.ok) throw new Error(cars.message || "Failed to load vehicles");
      setListings(Array.isArray(cars) ? cars : []);
    } finally {
      setDealerLookupComplete(true);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ============================
     Billing enforcement (HARD)
  ============================ */
  useEffect(() => {
  const now = new Date();

  if (billing?.is_on_trial && billing.trial_end) {
    if (new Date(billing.trial_end) <= now) {
      navigate("/pricing", { replace: true });
    }
  }

  if (dealerSub?.end_date) {
    if (new Date(dealerSub.end_date) <= now) {
      navigate("/pricing", { replace: true });
    }
  }
}, [billing, dealerSub, navigate]);


/* ============================
   Reminder banner logic (FIXED)
============================ */
useEffect(() => {
  const tick = () => {
    const now = new Date();

    // 🔹 Trial reminder
    if (billing?.is_on_trial && billing.trial_end) {
      const end = new Date(billing.trial_end);

      const d = differenceInDays(end, now);
      const h = differenceInHours(end, now) % 24;
      const m = differenceInMinutes(end, now) % 60;

      if (d <= 3 && d >= 0) {
        setBillingVariant("warning");
        setBillingMessage(
          `Your free trial ends in ${
            d > 0 ? `${d} day(s)` : h > 0 ? `${h} hour(s)` : `${m} minute(s)`
          }`
        );
      } else {
        setBillingMessage(null);
      }

      return;
    }

    // 🔹 Paid subscription reminder
    if (dealerSub?.end_date) {
      const end = new Date(dealerSub.end_date);
      const d = differenceInDays(end, now);

      if (d <= 7 && d >= 0) {
        setBillingVariant("warning");
        setBillingMessage(`Subscription expires in ${d} day(s).`);
      } else {
        setBillingMessage(null);
      }
    }
  };

  tick();
  const interval = setInterval(tick, 60_000);
  return () => clearInterval(interval);
}, [billing, dealerSub]);

  /* ============================
     Listing limit enforcement
  ============================ */
  const listingLimitReached =
  dealerSub &&
  dealerSub.listing_limit !== null &&
  listings.length >= dealerSub.listing_limit;

  /* ============================
     Save dealer profile
  ============================ */
  const saveDealerProfile = async () => {
    if (!dealer) return;

    const response = await fetch(`${API_BASE_URL}/dealer/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
      },
      credentials: "include",
      body: JSON.stringify(dealerForm),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      toast({ title: "Error", description: result.message || "Profile update failed" });
      return;
    }

    toast({
      title: "Profile submitted for verification",
      description: "Admin will review your details",
    });

    fetchData();
    navigate("/dealer");
  };

  /* ============================
     Submit vehicle
  ============================ */
  const submitCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealer) return;

    if (listingLimitReached) {
      toast({
        title: "Listing limit reached",
        description: "Upgrade your plan to add more vehicles.",
        variant: "destructive",
      });
      return;
    }

    setSavingCar(true);

    const response = await fetch(`${API_BASE_URL}/dealer/cars/draft`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
      },
      credentials: "include",
      body: JSON.stringify({
        ...carForm,
        gallery: carForm.gallery || [],
        video_url: carForm.video_url || null,
      }),
    });
    const result = await response.json().catch(() => ({}));

    setSavingCar(false);

    if (!response.ok) {
      toast({ title: "Error", description: result.message || result.error || "Vehicle submission failed" });
      return;
    }

    toast({ title: "Vehicle submitted", description: "Pending approval" });

    setIsCarDialogOpen(false);
    setCarForm({});
    setGalleryFiles([]);
    setCarStep(1);
    fetchData();
  };

  const editListing = (listing: Listing) => {
    setCarForm({ ...listing, gallery: listing.gallery || [], video_url: listing.video_url || null });
    setCarStep(1);
    setIsCarDialogOpen(true);
  };

  const markListingSold = async (listing: Listing) => {
    if (!window.confirm(`Mark ${listing.make} ${listing.model} as sold?`)) return;

    const response = await fetch(`${API_BASE_URL}/dealer/cars/${listing.id}/sold`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
      credentials: "include",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ title: "Error", description: result.message || "Could not update vehicle" });
      return;
    }
    toast({ title: "Vehicle marked as sold" });
    fetchData();
  };

  if (isLoading || !dealerLookupComplete) return <div className="p-10">Loading…</div>;

  if (!dealer) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold">Dealer profile not ready</h1>
        <p className="mt-2 text-muted-foreground">
          Your dealer role is active, but your dealer profile has not been created yet. Please contact an administrator.
        </p>
      </div>
    );
  }

  /* ============================
     Render
  ============================ */
    const isDealerVerified = dealer.verified === true || dealer.status?.toLowerCase() === "verified";

    if (location.pathname === "/dealer/profile") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50/40">
          <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => navigate("/dealer")}
              className="mb-6 flex items-center gap-2 text-sm font-semibold text-gray-600 transition hover:text-[#8B0000]"
            >
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </button>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-red-100/40">
              <div className="bg-gradient-to-r from-[#8B0000] to-[#b44b3e] px-6 py-8 text-white sm:px-10">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-red-100">Dealer account</p>
                <h1 className="mt-2 text-3xl font-bold">Your dealer profile</h1>
                <p className="mt-2 max-w-2xl text-sm text-red-100">Keep your business details accurate so buyers can trust and contact your dealership.</p>
              </div>

              <div className="p-6 sm:p-10">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-6">
                  <div>
                    <p className="text-sm text-gray-500">Verification status</p>
                    <p className="mt-1 text-lg font-semibold capitalize text-gray-900">{dealer.status}</p>
                  </div>
                  <Badge className="bg-red-50 px-3 py-1 text-[#8B0000] hover:bg-red-50">{dealer.status}</Badge>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  {["full_name", "company_name", "phone", "country", "city", "national_id", "tax_id", "company_logo"].map((field) => (
                    <div key={field} className={field === "company_logo" ? "md:col-span-2" : ""}>
                      <Label className="capitalize text-gray-700">{field.replace("_", " ")}</Label>
                      <Input
                        value={(dealerForm as any)[field] ?? ""}
                        onChange={(event) => setDealerForm({ ...dealerForm, [field]: event.target.value })}
                        className="mt-2 h-11 border-gray-200 bg-gray-50 focus:bg-white"
                      />
                    </div>
                  ))}
                  <div>
                    <Label className="text-gray-700">Email</Label>
                    <Input value={dealer.email} disabled className="mt-2 h-11 bg-gray-100" />
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <Button onClick={saveDealerProfile} className="bg-[#b44b3e] px-6 hover:bg-[#8B0000]">
                    <RefreshCw className="mr-2 h-4 w-4" /> Save & Resubmit
                  </Button>
                </div>
              </div>
            </div>
          </main>
        </div>
      );
    }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Dealer Dashboard</h1>

        <div className="flex gap-2">
          {isDealerVerified && !listingLimitReached ? (
            <Dialog open={isCarDialogOpen} onOpenChange={setIsCarDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Vehicle
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{carForm.id ? "Edit Vehicle Listing" : "New Vehicle Listing"}</DialogTitle>
                </DialogHeader>

                <DealerCarForm
                  step={carStep}
                  setStep={setCarStep}
                  form={carForm}
                  setForm={setCarForm}
                  errors={carErrors}
                  galleryFiles={galleryFiles}
                  setGalleryFiles={setGalleryFiles}
                  existingGallery={[]}
                  onSubmit={submitCar}
                  loading={savingCar}
                />

              </DialogContent>
            </Dialog>
          ) : (
            <Button
              variant="outline"
              onClick={() => navigate("/pricing")}
            >
              <Lock className="mr-2 h-4 w-4" />
              {listingLimitReached
                ? "Listing limit reached"
                : "Verify account to add vehicles"}
            </Button>
          )}

          <Button variant="outline" onClick={() => navigate("/dealer/profile")}>
            <User className="mr-2 h-4 w-4" /> Profile
          </Button>
        </div>
      </div>

      {/* Billing Reminder */}
      {billingMessage && (
        <Card className="p-4 mb-4 border-l-4 border-yellow-500 bg-yellow-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="font-medium">{billingMessage}</span>
            </div>
            <Button size="sm" onClick={() => navigate("/pricing")}>
              Upgrade
            </Button>
          </div>
        </Card>
      )}

      {/* Status */}
      <Card className="p-4 mb-4 border-l-4 border-yellow-500">
        Status: <b>{dealer.status}</b>
        {dealer.validation_message && ` — ${dealer.validation_message}`}
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="analytics" disabled={!isDealerVerified}>
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings">
          <div className="grid gap-4 mt-4">
            {listings.map((l) => (
              <Card key={l.id} className="p-4 flex justify-between">
                <div>
                  <h3 className="font-semibold">
                    {l.make} {l.model}
                  </h3>
                  <Badge>{l.status}</Badge>
                </div>
                <div className="flex gap-2">
                <Button variant="outline" onClick={() => editListing(l)}>
                  <Edit className="mr-2" /> Edit
                </Button>
                {l.status !== "sold" && (
                  <Button variant="outline" onClick={() => markListingSold(l)}>
                    Mark sold
                  </Button>
                )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <DealerAnalytics />
          <DealerViewsOverTime />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DealerDashboard;
