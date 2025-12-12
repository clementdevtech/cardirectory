import React, { useEffect, useState } from "react";
import axios from "axios";
import CarForm from "@/components/CarForm";
import DealerForm from "@/components/DealerForm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Car as CarIcon,
  Upload,
  Star,
  Trash2,
  UserPlus,
  UserX,
  Edit,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
} from "lucide-react";
import { Dialog } from "@headlessui/react";

import { useCarForm } from "@/hooks/useCarForm";
import { useCarUploads } from "@/hooks/useCarUploads";
import { useLocationSearch } from "@/hooks/useLocationSearch";

type Car = {
  id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  location?: string;
  description?: string;
  condition?: string;
  featured?: boolean;
  status?: string;
  gallery?: string[];
  video_url?: string;
  transmission?: string;
  phone?: string;
  dealer_id?: string | null;
  created_at?: string;
};

type Dealer = {
  id: string;
  full_name: string;
  company_name?: string;
  email: string;
  phone?: string;
  created_at?: string;
  company_logo?: string;
};

// env & api
const API_BASE = (import.meta.env.VITE_BACKEND_URL as string);
const ADMIN_API = API_BASE.endsWith("/admin") ? API_BASE : `${API_BASE}/admin`;
const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string;

const axiosInstance = axios.create({
  baseURL: ADMIN_API,
  withCredentials: true,
});
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AdminDashboard: React.FC = () => {
  const { toast } = useToast();

  const [cars, setCars] = useState<Car[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState({
    totalListings: 0,
    pendingApproval: 0,
    totalDealers: 0,
    totalRevenue: 0,
  });

  // hooks
  const { form, setForm, editId, startEdit, resetForm } = useCarForm();
  const {
    galleryPreview,
    galleryProgress,
    selectGalleryFiles,
    uploadAssets,
    resetUploads,
    setVideoFile,
  } = useCarUploads();
  const {
    query: locationQuery,
    setQuery: setLocationQuery,
    suggestions,
    isFetching,
  } = useLocationSearch(GEOAPIFY_API_KEY);

  // lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const openLightbox = (images: string[], startIndex = 0) => {
    setLightboxImages(images);
    setCurrentIndex(startIndex);
    setLightboxOpen(true);
  };
  const nextImage = () => setCurrentIndex((i) => (i + 1) % lightboxImages.length);
  const prevImage = () =>
    setCurrentIndex((i) => (i === 0 ? lightboxImages.length - 1 : i - 1));

  // fetch data
  const fetchDashboardData = async () => {
    try {
      const [carsRes, dealersRes] = await Promise.all([
        axiosInstance.get<Car[]>("/cars"),
        axiosInstance.get<Dealer[]>("/dealers"),
      ]);
      const carsData = carsRes.data || [];
      const dealersData = dealersRes.data || [];

      setCars(carsData);
      setDealers(dealersData);

      const totalListings = carsData.length;
      const pendingApproval = carsData.filter((c) => c.status === "pending").length;
      const totalDealers = dealersData.length;

      let totalRevenue = 0;
      try {
        const paymentsRes = await axios.get(`${API_BASE}/payments`);
        const payments = paymentsRes.data || [];
        totalRevenue =
          payments
            .filter((p: any) => p.status === "completed")
            .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0;
      } catch {
        totalRevenue = 0;
      }

      setStats({ totalListings, pendingApproval, totalDealers, totalRevenue });
    } catch (err: any) {
      console.error("Failed to load dashboard data:", err);
      toast({
        title: "Error loading data",
        description: err?.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // global event for lightbox (used by CarForm previews if you dispatch event)
  useEffect(() => {
    const handler = (e: any) => openLightbox(e.detail || []);
    window.addEventListener("open-lightbox", handler);
    return () => window.removeEventListener("open-lightbox", handler);
  }, []);

  // submit car (called from CarForm.onSubmit)
  const handleCarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.make || !form.model || !form.price) {
      toast({
        title: "Missing fields",
        description: "Please fill in make, model and price.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { galleryUrls, videoUrl } = await uploadAssets();

      const payload = {
        ...form,
        price: Number(form.price) || 0,
        year: Number(form.year) || 0,
        mileage: Number(form.mileage) || 0,
        gallery: [...(form.gallery || []), ...galleryUrls],
        video_url: videoUrl || form.video_url || "",
      };

      if (editId) {
        await axiosInstance.put(`/cars/${editId}`, payload);
        toast({ title: "Car updated successfully" });
      } else {
        await axiosInstance.post("/cars", payload);
        toast({ title: "Car added successfully" });
      }

      resetForm();
      resetUploads();
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Save failed",
        description: err?.response?.data?.message || err.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCar = async (id: number) => {
    if (!confirm("Are you sure you want to delete this car?")) return;
    try {
      await axiosInstance.delete(`/cars/${id}`);
      toast({ title: "Car deleted successfully" });
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.response?.data?.message || err.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleToggleFeatured = async (car: Car) => {
    try {
      await axiosInstance.patch(`/cars/${car.id}/featured`, { featured: !car.featured });
      toast({ title: "Updated", description: `${car.make} ${car.model}` });
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.response?.data?.message || err.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleApproval = async (id: number, status: "active" | "removed") => {
    try {
      await axiosInstance.patch(`/cars/${id}/status`, { status });
      toast({ title: "Success", description: `Car ${status}` });
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.response?.data?.message || err.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  // dealer flows (AdminDashboard will call API; DealerForm handles UI & base64 conversion)
  const handleCreateDealer = async (payload: any) => {
    try {
      await axiosInstance.post("/dealers", payload);
      toast({ title: "Dealer created successfully" });
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Error creating dealer",
        description: err?.response?.data?.message || err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleDeleteDealer = async (id: string) => {
    if (!confirm("Remove this dealer?")) return;
    try {
      await axiosInstance.delete(`/dealers/${id}`);
      toast({ title: "Dealer deleted successfully" });
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.response?.data?.message || err.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  // when user clicks edit on a car: populate form
  const startEditCar = (car: Car) => {
    startEdit(car);
    // show existing images in preview
    if (car.gallery && car.gallery.length > 0) {
      window.dispatchEvent(new CustomEvent("open-lightbox", { detail: car.gallery }));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pt-24 pb-16 container mx-auto px-4 space-y-10">
        <h1 className="text-4xl font-bold mb-6">Admin Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">Total Listings: {stats.totalListings}</Card>
          <Card className="p-6">Pending: {stats.pendingApproval}</Card>
          <Card className="p-6">Dealers: {stats.totalDealers}</Card>
          <Card className="p-6">Revenue: KES {Number(stats.totalRevenue).toLocaleString()}</Card>
        </div>

        {/* Car Management (CarForm is stateless UI) */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <CarIcon /> {editId ? "Edit Car" : "Add New Car"}
          </h2>

          <CarForm
  form={form}
  setForm={setForm}
  loading={loading}
  editMode={!!editId}
  galleryPreview={galleryPreview}
  setGalleryFiles={selectGalleryFiles}
  galleryProgress={galleryProgress}
  locationQuery={locationQuery}
  setLocationQuery={setLocationQuery}
  suggestions={suggestions}
  onSelectSuggestion={(place: any) => {
    setForm({ ...form, location: place.formatted });
    setLocationQuery(place.formatted);
  }}
  onSubmit={handleCarSubmit}
  onCancelEdit={() => {
    resetForm();
    resetUploads();
  }}
/>

        </Card>

        {/* Car Listings */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6">All Cars</h2>
          {cars.length === 0 ? (
            <p>No cars found.</p>
          ) : (
            cars.map((car) => (
              <div key={car.id} className="flex justify-between items-center border p-3 rounded mb-2">
                <div className="flex gap-4 items-center">
                  {Array.isArray(car.gallery) && car.gallery.length > 0 ? (
                    <img src={car.gallery[0]} alt={car.make} className="w-24 h-16 object-cover rounded cursor-pointer" onClick={() => openLightbox(car.gallery!)} />
                  ) : (
                    <div className="w-24 h-16 bg-gray-200 flex items-center justify-center">No Image</div>
                  )}
                  <div>
                    <h3 className="font-semibold">{car.make} {car.model} ({car.year})</h3>
                    <p className="text-sm text-gray-500">{car.location}</p>
                    <p className="text-sm text-gray-600">KES {Number(car.price).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Button size="sm" variant={car.featured ? "secondary" : "outline"} onClick={() => handleToggleFeatured(car)}>
                    <Star className={`w-4 h-4 ${car.featured ? "text-yellow-500" : "text-gray-400"}`} />
                  </Button>
                  <Button size="sm" onClick={() => startEditCar(car)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteCar(car.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  {car.status === "pending" && (
                    <>
                      <Button size="sm" className="bg-green-500" onClick={() => handleApproval(car.id, "active")}>
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleApproval(car.id, "removed")}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Dealers */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <UserPlus /> Add Dealer
          </h2>

          <DealerForm onCreate={handleCreateDealer} />

          <div className="mt-6">
            {dealers.length === 0 ? (
              <p>No dealers found.</p>
            ) : (
              dealers.map((d) => (
                <div key={d.id} className="flex justify-between items-center border p-3 rounded mb-2">
                  <div className="flex items-center gap-3">
                    {d.company_logo ? (
                      <img src={d.company_logo} alt="logo" className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-200 rounded" />
                    )}
                    <div>
                      <p className="font-semibold">{d.full_name}</p>
                      <p className="text-sm text-gray-500">{d.email}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteDealer(d.id)}>
                    <UserX className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </main>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)}>
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="relative max-w-4xl w-full p-4">
            {lightboxImages[currentIndex] && (
              <img src={lightboxImages[currentIndex]} alt="Gallery" className="w-full rounded-lg" />
            )}
            <button className="absolute top-4 right-4 bg-white rounded-full px-3 py-2" onClick={() => setLightboxOpen(false)}>✕</button>
            {lightboxImages.length > 1 && (
              <>
                <button className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full px-3 py-2" onClick={prevImage}>‹</button>
                <button className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full px-3 py-2" onClick={nextImage}>›</button>
              </>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
