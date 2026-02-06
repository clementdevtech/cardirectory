import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";

import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
} from "date-fns";

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
  gallery?: string[];
}

/* ============================
   Component
============================ */
const DealerDashboard: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [dealerForm, setDealerForm] = useState<Partial<Dealer>>({});
  
  const [billing, setBilling] = useState<UserBilling | null>(null);
  const [dealerSub, setDealerSub] = useState<DealerSubscription | null>(null);

  const [listings, setListings] = useState<Listing[]>([]);

  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [billingVariant, setBillingVariant] = useState<
    "default" | "warning" | "destructive"
  >("default");

  const [isProfileOpen, setIsProfileOpen] = useState(false);
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

    const { data: dealer } = await supabase
      .from("dealers")
      .select("*")
      .eq("user_id", user.id)
      .single();

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


    const { data: cars } = await supabase
      .from("cars")
      .select("id, make, model, year, status, gallery")
      .eq("dealer_id", dealer.id)
      .order("created_at", { ascending: false });

    setListings(cars ?? []);
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

    await supabase
      .from("dealers")
      .update({
        ...dealerForm,
        status: "pending",
        validation_message: null,
      })
      .eq("id", dealer.id);

    toast({
      title: "Profile submitted for verification",
      description: "Admin will review your details",
    });

    setIsProfileOpen(false);
    fetchData();
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

    const { error } = await supabase.from("cars").insert({
      ...carForm,
      dealer_id: dealer.id,
      status: "pending",
    });

    setSavingCar(false);

    if (error) {
      toast({ title: "Error", description: error.message });
      return;
    }

    toast({ title: "Vehicle submitted", description: "Pending approval" });

    setIsCarDialogOpen(false);
    setCarForm({});
    setGalleryFiles([]);
    setCarStep(1);
    fetchData();
  };

  if (isLoading || !dealer) return <div className="p-10">Loading…</div>;

  /* ============================
     Render
  ============================ */
  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Dealer Dashboard</h1>

        <div className="flex gap-2">
          {dealer.status === "verified" && !listingLimitReached ? (
            <Dialog open={isCarDialogOpen} onOpenChange={setIsCarDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Vehicle
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>New Vehicle Listing</DialogTitle>
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

          <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <User className="mr-2 h-4 w-4" /> Profile
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Dealer Profile</DialogTitle>
              </DialogHeader>

              {[
                "full_name",
                "company_name",
                "phone",
                "country",
                "city",
                "national_id",
                "tax_id",
                "company_logo",
              ].map((f) => (
                <div key={f} className="mb-3">
                  <Label>{f.replace("_", " ")}</Label>
                  <Input
                    value={(dealerForm as any)[f] ?? ""}
                    onChange={(e) =>
                      setDealerForm({ ...dealerForm, [f]: e.target.value })
                    }
                  />
                </div>
              ))}

              <Label>Email</Label>
              <Input value={dealer.email} disabled />

              <Button onClick={saveDealerProfile} className="w-full mt-4">
                <RefreshCw className="mr-2 h-4 w-4" />
                Save & Resubmit
              </Button>
            </DialogContent>
          </Dialog>
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
          <TabsTrigger value="analytics" disabled={dealer.status !== "verified"}>
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
                <Button variant="outline">
                  <Edit className="mr-2" /> Edit
                </Button>
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
