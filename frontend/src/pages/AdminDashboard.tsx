// src/pages/AdminDashboard.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
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

// Environment
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;
const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string;
const API_BASE = (import.meta.env.VITE_BACKEND_URL as string);
const ADMIN_API = API_BASE.endsWith("/admin") ? API_BASE : `${API_BASE}/admin`;

// Types (lightweight)
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

interface UploadProgress {
  fileName: string;
  progress: number;
  url?: string;
}

interface GeoapifyPlace {
  formatted: string;
  place_id: string;
}

const axiosInstance = axios.create({
  baseURL: ADMIN_API,
  withCredentials: true,
});

// attach jwt from localStorage if present
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

  // Car form state
  const [form, setForm] = useState<Partial<Car>>({
    make: "",
    model: "",
    year: 0,
    mileage: 0,
    condition: "good",
    transmission: "",
    price: 0,
    location: "",
    phone: "",
    description: "",
    featured: false,
    gallery: [],
    video_url: "",
    dealer_id: null,
    status: "active",
  });

  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryProgress, setGalleryProgress] = useState<UploadProgress[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoProgress, setVideoProgress] = useState<UploadProgress | null>(null);

  const [locationQuery, setLocationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoapifyPlace[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Dealer creation state
  const [newDealer, setNewDealer] = useState({
    full_name: "",
    email: "",
    company_name: "",
    phone: "",
  });

  // Dealer logo states (upload + preview)
  const [dealerLogoFile, setDealerLogoFile] = useState<File | null>(null);
  const [dealerLogoUrl, setDealerLogoUrl] = useState<string>("");
  const [dealerLogoProgress, setDealerLogoProgress] = useState<number>(0);

  const [editCarId, setEditCarId] = useState<number | null>(null);

  // ---------- Helpers: Cloudinary upload with progress ----------
  const uploadWithProgress = (
    file: File,
    resourceType: "image" | "video",
    onProgress: (p: number) => void
  ): Promise<string> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
      xhr.open("POST", url);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } else {
          reject(new Error(`Cloudinary upload failed: ${xhr.statusText || xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      xhr.send(fd);
    });

  // ---------- Fetch dashboard data ----------
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

      // compute basic stats
      const totalListings = carsData.length;
      const pendingApproval = carsData.filter((c) => c.status === "pending").length;
      const totalDealers = dealersData.length;

      // Attempt to fetch payments for revenue (fallback to 0)
      let totalRevenue = 0;
      try {
        // payments route is mounted at /api/payments on your backend (not under /admin).
        // We'll attempt to fetch using API_BASE (not ADMIN_API) to match server structure.
        const paymentsRes = await axios.get(`${API_BASE}/payments`);
        const payments = paymentsRes.data || [];
        totalRevenue =
          payments
            .filter((p: any) => p.status === "completed")
            .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0;
      } catch {
        totalRevenue = 0; // not critical; show 0 if payments endpoint unavailable
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

  // ---------- Geoapify suggestions ----------
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!locationQuery.trim()) {
        setSuggestions([]);
        return;
      }
      setIsFetching(true);
      try {
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
            locationQuery
          )}&limit=5&apiKey=${GEOAPIFY_API_KEY}`
        );
        const data = await res.json();
        const results: GeoapifyPlace[] =
          data.features?.map((f: any) => ({
            formatted: f.properties.formatted,
            place_id: f.properties.place_id,
          })) || [];
        setSuggestions(results);
      } catch (e) {
        setSuggestions([]);
      } finally {
        setIsFetching(false);
      }
    };

    const t = setTimeout(fetchSuggestions, 350);
    return () => clearTimeout(t);
  }, [locationQuery]);

  // ---------- Lightbox ----------
  const openLightbox = (images: string[]) => {
    setLightboxImages(images);
    setCurrentIndex(0);
    setLightboxOpen(true);
  };
  const nextImage = () => setCurrentIndex((i) => (i + 1) % lightboxImages.length);
  const prevImage = () =>
    setCurrentIndex((i) => (i === 0 ? lightboxImages.length - 1 : i - 1));

  // ---------- CRUD handlers ----------
  const handleSubmit = async (e: React.FormEvent) => {
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
      // Upload gallery files to Cloudinary (parallel)
      const galleryUrls = await Promise.all(
        galleryFiles.map((file) =>
          uploadWithProgress(file, "image", (progress) =>
            setGalleryProgress((prev) => [
              ...prev.filter((p) => p.fileName !== file.name),
              { fileName: file.name, progress },
            ])
          )
        )
      );

      // Upload video if any
      let videoUrl: string | undefined = form.video_url;
      if (videoFile) {
        videoUrl = await uploadWithProgress(videoFile, "video", (progress) =>
          setVideoProgress({ fileName: videoFile.name, progress })
        );
      }

      const payload = {
        ...form,
        price: Number(form.price) || 0,
        year: Number(form.year) || 0,
        mileage: Number(form.mileage) || 0,
        gallery: [...(form.gallery || []), ...galleryUrls],
        video_url: videoUrl || "",
      };

      if (editCarId) {
        await axiosInstance.put(`/cars/${editCarId}`, payload);
        toast({ title: "Car updated successfully" });
        setEditCarId(null);
      } else {
        await axiosInstance.post("/cars", payload);
        toast({ title: "Car added successfully" });
      }

      // reset form
      setForm({
        make: "",
        model: "",
        year: 0,
        mileage: 0,
        condition: "good",
        transmission: "",
        price: 0,
        location: "",
        phone: "",
        description: "",
        featured: false,
        gallery: [],
        video_url: "",
        dealer_id: null,
        status: "active",
      });
      setGalleryFiles([]);
      setVideoFile(null);
      setGalleryProgress([]);
      setVideoProgress(null);

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

  // Dealers
  const handleDealerLogoSelect = async (file: File | null) => {
    if (!file) return;
    setDealerLogoFile(file);
    setDealerLogoProgress(0);
    try {
      const url = await uploadWithProgress(file, "image", (p) => setDealerLogoProgress(p));
      setDealerLogoUrl(url);
      // keep preview and set url on newDealer when user submits
    } catch (err: any) {
      toast({
        title: "Logo upload failed",
        description: err?.message || "Upload failed",
        variant: "destructive",
      });
      setDealerLogoFile(null);
      setDealerLogoProgress(0);
      setDealerLogoUrl("");
    }
  };

  const handleAddDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDealer.full_name || !newDealer.email) {
      toast({
        title: "Missing fields",
        description: "Please enter dealer name and email.",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = {
        ...newDealer,
        company_logo: dealerLogoUrl || null,
      };
      await axiosInstance.post("/dealers", payload);
      toast({ title: "Dealer added successfully" });

      setNewDealer({ full_name: "", email: "", company_name: "", phone: "" });
      setDealerLogoFile(null);
      setDealerLogoUrl("");
      setDealerLogoProgress(0);
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Error adding dealer",
        description: err?.response?.data?.message || err.message || "An error occurred",
        variant: "destructive",
      });
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

  // When user clicks edit on a car: populate form
  const startEditCar = (car: Car) => {
    setEditCarId(car.id);
    setForm({
      ...car,
      price: Number(car.price),
      year: car.year,
      mileage: Number(car.mileage),
    });
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

        {/* Car Management */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <CarIcon /> {editCarId ? "Edit Car" : "Add New Car"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Make</Label>
                <Input value={form.make || ""} onChange={(e) => setForm({ ...form, make: e.target.value })} />
              </div>
              <div>
                <Label>Model</Label>
                <Input value={form.model || ""} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
              <div>
                <Label>Year</Label>
                <Input type="number" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Mileage (km)</Label>
                <Input type="number" value={form.mileage ?? ""} onChange={(e) => setForm({ ...form, mileage: Number(e.target.value) })} />
              </div>
            </div>

            <div>
              <Label>Upload Photos</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer"
                onClick={() => document.getElementById("gallery-input")?.click()}
              >
                <Upload className="mx-auto text-gray-400" />
                <p>Click or drag & drop (max 8)</p>
                <input
                  id="gallery-input"
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => setGalleryFiles(Array.from(e.target.files || []).slice(0, 8))}
                />
                {/* progress rows */}
                <div className="mt-3 space-y-2">
                  {galleryProgress.map((p) => (
                    <div key={p.fileName} className="text-sm">
                      {p.fileName} — {p.progress}%
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Label>Price (KES)</Label>
            <Input type="number" value={form.price ?? ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />

            <Label>Location</Label>
            <Input value={locationQuery || form.location || ""} onChange={(e) => setLocationQuery(e.target.value)} placeholder="Search location..." />
            {isFetching && <p>Loading suggestions...</p>}
            {suggestions.map((s) => (
              <div
                key={s.place_id}
                className="p-2 border cursor-pointer hover:bg-gray-100"
                onClick={() => {
                  setForm({ ...form, location: s.formatted });
                  setLocationQuery(s.formatted);
                  setSuggestions([]);
                }}
              >
                {s.formatted}
              </div>
            ))}

            <Label>Phone</Label>
            <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

            <Label>Description</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />

            <div className="flex items-center gap-2">
              <input type="checkbox" checked={!!form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
              <Label className="flex items-center gap-1">
                <Star className="text-yellow-500 w-4 h-4" /> Feature this car
              </Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : editCarId ? "Update Car" : "Add Car"}
              </Button>
              {editCarId && (
                <Button type="button" variant="ghost" onClick={() => { setEditCarId(null); setForm({ ...form, make: "", model: "", price: 0 }); }}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
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
                  {car.gallery?.length ? (
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
          <h2 className="text-2xl font-bold mb-6">Dealers</h2>
          <form onSubmit={handleAddDealer} className="grid md:grid-cols-4 gap-4 mb-6">
            <Input placeholder="Full Name" value={newDealer.full_name} onChange={(e) => setNewDealer({ ...newDealer, full_name: e.target.value })} />
            <Input placeholder="Email" value={newDealer.email} onChange={(e) => setNewDealer({ ...newDealer, email: e.target.value })} />
            <Input placeholder="Company" value={newDealer.company_name} onChange={(e) => setNewDealer({ ...newDealer, company_name: e.target.value })} />
            <Input placeholder="Phone" value={newDealer.phone} onChange={(e) => setNewDealer({ ...newDealer, phone: e.target.value })} />

            {/* Dealer Logo Upload (integrated in Add Dealer form) */}
            <div className="md:col-span-4 border-2 border-dashed rounded-lg p-4 text-center">
              <label className="cursor-pointer inline-flex flex-col items-center w-full">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f) handleDealerLogoSelect(f);
                  }}
                />
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="mx-auto text-gray-400" />
                  <p className="text-sm text-gray-600">
                    {dealerLogoFile ? `${dealerLogoFile.name} — ${dealerLogoProgress}%` : "Click to upload dealer logo (optional)"}
                  </p>
                  {dealerLogoProgress > 0 && dealerLogoProgress < 100 && (
                    <div className="w-full bg-gray-100 rounded overflow-hidden mt-2">
                      <div style={{ width: `${dealerLogoProgress}%` }} className="h-2 bg-blue-500" />
                    </div>
                  )}
                  {dealerLogoUrl && (
                    <img src={dealerLogoUrl} alt="Dealer logo" className="w-24 h-24 rounded-full object-cover mt-3 mx-auto" />
                  )}
                </div>
              </label>
            </div>

            <Button type="submit" className="md:col-span-4">
              <UserPlus className="w-4 h-4 mr-1" /> Add Dealer
            </Button>
          </form>

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
