import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Car, MessageSquare, TrendingUp, Plus, Edit, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";

// -------------------- 🧩 TypeScript Interfaces --------------------
interface Dealer {
  id: string;
  user_id: string;
  full_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  location?: string;
}

interface Listing {
  id: number;
  dealer_id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  condition: string;
  location: string;
  description: string;
  phone: string;
  status: "pending" | "active" | "removed";
  created_at?: string;
}

interface Subscription {
  id: number;
  dealer_id: string;
  plan_name: string;
  listing_limit: number;
  status: "active" | "expired";
}

interface TrialInfo {
  trialEnd: string | null;
  expired: boolean;
}

// -------------------- 🧭 Component --------------------
const DealerDashboard = () => {
  const { user, userRole, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [dealerProfile, setDealerProfile] = useState<Dealer | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [trialInfo, setTrialInfo] = useState<TrialInfo>({ trialEnd: null, expired: false });
  const [remainingTime, setRemainingTime] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editListing, setEditListing] = useState<Listing | null>(null);

  const [newListing, setNewListing] = useState<Omit<Listing, "id" | "dealer_id" | "status">>({
    make: "",
    model: "",
    year: new Date().getFullYear(),
    price: 0,
    mileage: 0,
    condition: "foreign_used",
    location: "",
    description: "",
    phone: "",
  });

  // 🔐 Redirect unauthorized users
  useEffect(() => {
    if (!isLoading && (!user || userRole !== "dealer")) {
      navigate("/login");
    }
  }, [user, userRole, isLoading, navigate]);

  // 🧠 Fetch dealer data
  const fetchDealerData = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("dealers")
        .select("*")
        .eq("user_id", user?.id)
        .single<Dealer>();

      setDealerProfile(profile);

      if (profile) {
        const { data: listingsData } = await supabase
          .from("cars")
          .select("*")
          .eq("dealer_id", profile.id)
          .order("created_at", { ascending: false })
          .returns<Listing[]>();

        setListings(listingsData || []);

        const { data: subData } = await supabase
          .from("dealer_subscriptions")
          .select("*")
          .eq("dealer_id", profile.id)
          .eq("status", "active")
          .single<Subscription>();

        setSubscription(subData);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Error loading dealer data",
        description: message,
        variant: "destructive",
      });
    }
  }, [toast, user?.id]);

  // ⏳ Fetch trial info
  const fetchTrialInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("trial_end")
        .eq("id", user?.id)
        .single<{ trial_end: string | null }>();

      if (error) throw error;
      if (data?.trial_end) {
        const end = new Date(data.trial_end);
        setTrialInfo({ trialEnd: end.toISOString(), expired: end <= new Date() });
      }
    } catch (err) {
      console.error("Error fetching trial info:", err);
    }
  }, [user?.id]);

  // ⏱️ Start trial countdown
  useEffect(() => {
    if (!trialInfo.trialEnd) return;

    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date(trialInfo.trialEnd);

      if (end <= now) {
        setTrialInfo((prev) => ({ ...prev, expired: true }));
        setRemainingTime("Trial expired");
        clearInterval(interval);
        return;
      }

      const days = differenceInDays(end, now);
      const hours = differenceInHours(end, now) % 24;
      const minutes = differenceInMinutes(end, now) % 60;

      if (days > 0) setRemainingTime(`${days} day${days > 1 ? "s" : ""} left`);
      else if (hours > 0) setRemainingTime(`${hours} hour${hours > 1 ? "s" : ""} left`);
      else setRemainingTime(`${minutes} minute${minutes > 1 ? "s" : ""} left`);
    }, 1000);

    return () => clearInterval(interval);
  }, [trialInfo.trialEnd]);

  // Fetch everything on mount
  useEffect(() => {
    if (user && userRole === "dealer") {
      fetchDealerData();
      fetchTrialInfo();
    }
  }, [user, userRole, fetchDealerData, fetchTrialInfo]);

  // 🆕 Create listing
  const handleCreateListing = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!dealerProfile) {
      toast({
        title: "Error",
        description: "Please set up your dealer profile first.",
        variant: "destructive",
      });
      return;
    }

    if (subscription?.listing_limit && listings.length >= subscription.listing_limit) {
      toast({
        title: "Listing Limit Reached",
        description: "You have reached your subscription limit. Upgrade your plan.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("cars").insert({
      dealer_id: dealerProfile.id,
      ...newListing,
      status: "pending",
    });

    if (error) {
      toast({
        title: "Error creating listing",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Success", description: "Listing submitted for admin approval!" });
    setIsDialogOpen(false);
    setNewListing({
      make: "",
      model: "",
      year: new Date().getFullYear(),
      price: 0,
      mileage: 0,
      condition: "foreign_used",
      location: "",
      description: "",
      phone: "",
    });

    fetchDealerData();
  };

  // ✏️ Edit listing
  const handleEditListing = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editListing) return;

    const { error } = await supabase
      .from("cars")
      .update({
        make: editListing.make,
        model: editListing.model,
        year: editListing.year,
        price: editListing.price,
        mileage: editListing.mileage,
        condition: editListing.condition,
        location: editListing.location,
        description: editListing.description,
        phone: editListing.phone,
        status: "pending",
      })
      .eq("id", editListing.id);

    if (error) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Success", description: "Listing updated successfully!" });
    setIsEditOpen(false);
    setEditListing(null);
    fetchDealerData();
  };

  const stats = {
    totalListings: listings.length,
    approvedListings: listings.filter((l) => l.status === "active").length,
    pendingListings: listings.filter((l) => l.status === "pending").length,
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user || userRole !== "dealer") return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🚀 Trial Banner */}
      {trialInfo.trialEnd && (
        <div
          className={`p-4 flex items-center justify-between border-b ${
            trialInfo.expired
              ? "bg-red-100 border-red-300 text-red-700"
              : "bg-yellow-100 border-yellow-300 text-yellow-800"
          }`}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <div>
              {trialInfo.expired ? (
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
          {trialInfo.expired && (
            <Button onClick={() => navigate("/pricing")} className="bg-primary text-white">
              Upgrade Now
            </Button>
          )}
        </div>
      )}

      {/* Dashboard Content */}
      <div className="pt-24 pb-16 container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-heading font-bold text-4xl">Dealer Dashboard</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-hero">
                <Plus className="w-4 h-4 mr-2" /> Add Listing
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Listing</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateListing} className="space-y-4">
                {["make", "model", "location", "phone"].map((field) => (
                  <div key={field}>
                    <Label className="capitalize">{field}</Label>
                    <Input
                      required
                      value={(newListing as any)[field]}
                      onChange={(e) =>
                        setNewListing({ ...newListing, [field]: e.target.value })
                      }
                    />
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Year</Label>
                    <Input
                      type="number"
                      required
                      value={newListing.year}
                      onChange={(e) =>
                        setNewListing({ ...newListing, year: parseInt(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Price (KES)</Label>
                    <Input
                      type="number"
                      required
                      value={newListing.price}
                      onChange={(e) =>
                        setNewListing({ ...newListing, price: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newListing.description}
                    onChange={(e) =>
                      setNewListing({ ...newListing, description: e.target.value })
                    }
                  />
                </div>

                <Button type="submit" className="w-full gradient-hero">
                  Submit Listing
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Listings</p>
                <p className="text-3xl font-bold">{stats.totalListings}</p>
              </div>
              <Car className="w-10 h-10 text-primary opacity-20" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-3xl font-bold">{stats.approvedListings}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-accent opacity-20" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold">{stats.pendingListings}</p>
              </div>
              <MessageSquare className="w-10 h-10 text-accent opacity-20" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DealerDashboard;
