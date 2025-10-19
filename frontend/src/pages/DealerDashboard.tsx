import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Car, Eye, MessageSquare, TrendingUp, Plus, Edit } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DealerDashboard = () => {
  const { user, userRole, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [dealerProfile, setDealerProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editListing, setEditListing] = useState<any>(null);

  const [newListing, setNewListing] = useState({
    make: "",
    model: "",
    year: new Date().getFullYear(),
    price: "",
    mileage: "",
    condition: "foreign_used",
    location: "",
    description: "",
    phone: "",
  });

  // Redirect unauthorized users
  useEffect(() => {
    if (!isLoading && (!user || userRole !== "dealer")) {
      navigate("/login");
    }
  }, [user, userRole, isLoading, navigate]);

  // Fetch dealer data
  useEffect(() => {
    if (user && userRole === "dealer") {
      fetchDealerData();
    }
  }, [user, userRole]);

  const fetchDealerData = async () => {
    try {
      const { data: profile } = await supabase
        .from("dealers")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      setDealerProfile(profile);

      if (profile) {
        const { data: listingsData } = await supabase
          .from("cars")
          .select("*")
          .eq("dealer_id", profile.id)
          .order("created_at", { ascending: false });

        setListings(listingsData || []);

        const { data: subData } = await supabase
          .from("dealer_subscriptions")
          .select("*")
          .eq("dealer_id", profile.id)
          .eq("status", "active")
          .single();

        setSubscription(subData);
      }
    } catch (err: any) {
      toast({
        title: "Error loading dealer data",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // 🆕 Create new car listing
  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dealerProfile) {
      toast({
        title: "Error",
        description: "Please set up your dealer profile first.",
        variant: "destructive",
      });
      return;
    }

    if (
      subscription &&
      subscription.listing_limit &&
      listings.length >= subscription.listing_limit
    ) {
      toast({
        title: "Listing Limit Reached",
        description: "You have reached your subscription limit. Upgrade your plan.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("cars").insert({
      dealer_id: dealerProfile.id,
      make: newListing.make,
      model: newListing.model,
      year: newListing.year,
      price: parseFloat(newListing.price),
      mileage: parseFloat(newListing.mileage || "0"),
      condition: newListing.condition,
      location: newListing.location,
      description: newListing.description,
      phone: newListing.phone,
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

    toast({
      title: "Success",
      description: "Listing submitted for admin approval!",
    });

    setIsDialogOpen(false);
    setNewListing({
      make: "",
      model: "",
      year: new Date().getFullYear(),
      price: "",
      mileage: "",
      condition: "foreign_used",
      location: "",
      description: "",
      phone: "",
    });

    fetchDealerData();
  };

  // ✏️ Handle Edit Listing
  const handleEditListing = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editListing) return;

    const { error } = await supabase
      .from("cars")
      .update({
        make: editListing.make,
        model: editListing.model,
        year: editListing.year,
        price: parseFloat(editListing.price),
        mileage: parseFloat(editListing.mileage || "0"),
        condition: editListing.condition,
        location: editListing.location,
        description: editListing.description,
        phone: editListing.phone,
        status: "pending", // Reset to pending for re-approval
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

    toast({
      title: "Success",
      description: "Listing updated and submitted for re-approval!",
    });

    setIsEditOpen(false);
    setEditListing(null);
    fetchDealerData();
  };

  const stats = {
    totalListings: listings.length,
    approvedListings: listings.filter((l) => l.status === "active").length,
    pendingListings: listings.filter((l) => l.status === "pending").length,
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user || userRole !== "dealer") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
  

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
                {[
                  ["Make", "make"],
                  ["Model", "model"],
                  ["Location", "location"],
                  ["Phone Number", "phone"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <Input
                      required
                      value={(newListing as any)[key]}
                      onChange={(e) =>
                        setNewListing({ ...newListing, [key]: e.target.value })
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
                        setNewListing({ ...newListing, price: e.target.value })
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

        {/* Listings */}
        <Card className="p-6">
          <h2 className="font-heading font-bold text-2xl mb-6">My Listings</h2>
          {listings.length === 0 ? (
            <p className="text-muted-foreground">No listings yet. Add one!</p>
          ) : (
            <div className="space-y-4">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-white"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">
                        {listing.make} {listing.model} ({listing.year})
                      </h3>
                      <Badge
                        variant={
                          listing.status === "active"
                            ? "default"
                            : listing.status === "pending"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {listing.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Location: {listing.location}
                    </p>
                    <p className="font-semibold text-primary mt-1">
                      KES {Number(listing.price).toLocaleString()}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditListing(listing);
                      setIsEditOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-1" /> Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ✏️ Edit Listing Dialog */}
      {editListing && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Listing</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditListing} className="space-y-4">
              {["make", "model", "location", "phone", "price", "year", "description"].map(
                (field) => (
                  <div key={field}>
                    <Label className="capitalize">{field}</Label>
                    <Input
                      value={editListing[field] || ""}
                      onChange={(e) =>
                        setEditListing({ ...editListing, [field]: e.target.value })
                      }
                    />
                  </div>
                )
              )}
              <Button type="submit" className="w-full gradient-hero">
                Save Changes
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};

export default DealerDashboard;