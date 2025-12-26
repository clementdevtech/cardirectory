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
import { useDealerNotifications } from "@/utils/useDealerNotifications";

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

interface UserTrial {
  is_on_trial: boolean;
  trial_end: string | null;
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
  const [trial, setTrial] = useState<UserTrial | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [remainingTrial, setRemainingTrial] = useState("");

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
     Guard
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

    const { data: trial } = await supabase
      .from("users")
      .select("is_on_trial, trial_end")
      .eq("id", user.id)
      .single();

    setTrial(trial);

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
     Trial countdown
  ============================ */
  useEffect(() => {
    if (!trial?.is_on_trial || !trial.trial_end) return;

    const tick = () => {
      const now = new Date();
      const end = new Date(trial.trial_end);

      if (end <= now) return setRemainingTrial("Expired");

      const d = differenceInDays(end, now);
      const h = differenceInHours(end, now) % 24;
      const m = differenceInMinutes(end, now) % 60;

      if (d > 0) setRemainingTrial(`${d} day(s) left`);
      else if (h > 0) setRemainingTrial(`${h} hour(s) left`);
      else setRemainingTrial(`${m} minute(s) left`);
    };

    tick();
    const i = setInterval(tick, 60000);
    return () => clearInterval(i);
  }, [trial]);

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

  if (isLoading) return <div className="p-10">Loading…</div>;

  /* ============================
     Render
  ============================ */
  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Dealer Dashboard</h1>

        <div className="flex gap-2">
          {/* Add Vehicle */}
          {dealer?.status === "verified" ? (
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
            <Button variant="outline" disabled>
              <Lock className="mr-2 h-4 w-4" />
              Verify account to add vehicles
            </Button>
          )}

          {/* Profile */}
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
              <Input value={dealer?.email} disabled />

              <Button onClick={saveDealerProfile} className="w-full mt-4">
                <RefreshCw className="mr-2 h-4 w-4" />
                Save & Resubmit
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status */}
      <Card className="p-4 mb-4 border-l-4 border-yellow-500">
        Status: <b>{dealer?.status}</b>
        {dealer?.validation_message && ` — ${dealer.validation_message}`}
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="analytics" disabled={dealer?.status !== "verified"}>
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
