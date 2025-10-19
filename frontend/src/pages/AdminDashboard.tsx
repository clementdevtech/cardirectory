import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  XCircle,
  Users,
  Car,
  DollarSign,
  TrendingUp,
  Image as ImageIcon,
} from "lucide-react";
import { Dialog } from "@headlessui/react";

const AdminDashboard = () => {
  const { user, userRole, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingListings, setPendingListings] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalListings: 0,
    pendingApproval: 0,
    totalDealers: 0,
    totalRevenue: 0,
  });

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isLoading && (!user || userRole !== "admin")) {
      navigate("/login");
    }
  }, [user, userRole, isLoading, navigate]);

useEffect(() => {
  if (user && userRole === "admin") {
    fetchDashboardData();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user, userRole]);

  const fetchDashboardData = async () => {
    try {
      // 🧩 Pending cars
      const { data: listings, error: listErr } = await supabase
        .from("cars")
        .select("*, dealers(full_name, company_name, email)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (listErr) throw listErr;
      setPendingListings(listings || []);

      // 📊 Stats
      const { count: totalListings } = await supabase
        .from("cars")
        .select("*", { count: "exact", head: true });

      const { count: pendingApproval } = await supabase
        .from("cars")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: totalDealers } = await supabase
        .from("dealers")
        .select("*", { count: "exact", head: true });

      const { data: payments } = await supabase
        .from("payments")
        .select("amount")
        .eq("status", "completed");

      const totalRevenue =
        payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      setStats({
        totalListings: totalListings || 0,
        pendingApproval: pendingApproval || 0,
        totalDealers: totalDealers || 0,
        totalRevenue,
      });
    } catch (error: any) {
      toast({
        title: "Error loading dashboard",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApproval = async (listingId: number, status: "active" | "removed") => {
    const { error } = await supabase
      .from("cars")
      .update({
        status,
        featured: status === "active" ? true : false,
      })
      .eq("id", listingId);

    if (error) {
      toast({
        title: "Error updating car status",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Car ${status === "active" ? "approved" : "rejected"} successfully!`,
      });
      fetchDashboardData();
    }
  };

  const openLightbox = (images: string[]) => {
    setLightboxImages(images);
    setCurrentIndex(0);
    setLightboxOpen(true);
  };

  const nextImage = () =>
    setCurrentIndex((prev) => (prev + 1) % lightboxImages.length);
  const prevImage = () =>
    setCurrentIndex((prev) =>
      prev === 0 ? lightboxImages.length - 1 : prev - 1
    );

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user || userRole !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pt-24 pb-16 container mx-auto px-4">
        <h1 className="font-heading font-bold text-4xl mb-8">Admin Dashboard</h1>

        {/* 🧮 Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-3xl font-bold">{stats.pendingApproval}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-accent opacity-20" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Dealers</p>
                <p className="text-3xl font-bold">{stats.totalDealers}</p>
              </div>
              <Users className="w-10 h-10 text-primary opacity-20" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-3xl font-bold">
                  KES {stats.totalRevenue.toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-accent opacity-20" />
            </div>
          </Card>
        </div>

        {/* 🚗 Pending Listings */}
        <Card className="p-6">
          <h2 className="font-heading font-bold text-2xl mb-6">Pending Listings</h2>
          {pendingListings.length === 0 ? (
            <p className="text-muted-foreground">No pending listings.</p>
          ) : (
            <div className="space-y-4">
              {pendingListings.map((car) => (
                <div
                  key={car.id}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg bg-white gap-4"
                >
                  <div className="flex items-start gap-4">
                    {/* Car image preview */}
                    <div
                      className="w-32 h-24 bg-gray-100 rounded overflow-hidden cursor-pointer"
                      onClick={() => openLightbox(car.gallery || [])}
                    >
                      {car.gallery?.[0] ? (
                        <img
                          src={car.gallery[0]}
                          alt={`${car.make} ${car.model}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg">
                        {car.make} {car.model} ({car.year})
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Dealer: {car.dealers?.company_name || car.dealers?.full_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Location: {car.location}
                      </p>
                      <p className="font-semibold text-primary mt-1">
                        KES {Number(car.price).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproval(car.id, "active")}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleApproval(car.id, "removed")}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>

      {/* 🖼️ Lightbox Modal */}
      <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)}>
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="relative max-w-4xl w-full p-4">
            <img
              src={lightboxImages[currentIndex]}
              alt="Gallery"
              className="w-full h-auto rounded-lg"
            />
            <button
              className="absolute top-4 right-4 bg-white rounded-full px-3 py-2"
              onClick={() => setLightboxOpen(false)}
            >
              ✕
            </button>
            {lightboxImages.length > 1 && (
              <>
                <button
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full px-3 py-2"
                  onClick={prevImage}
                >
                  ‹
                </button>
                <button
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full px-3 py-2"
                  onClick={nextImage}
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
