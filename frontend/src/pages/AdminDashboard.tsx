import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Upload,
  Star,
} from "lucide-react";
import { Dialog } from "@headlessui/react";
import type { Database } from "@/types/db";

// ---- Constants ----
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

type CarInsert = Database["public"]["Tables"]["cars"]["Insert"];

interface UploadProgress {
  fileName: string;
  progress: number;
  url?: string;
}

interface GeoapifyPlace {
  formatted: string;
  place_id: string;
}

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

  // ---- Admin Add Vehicle State ----
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    make: "",
    model: "",
    year: "",
    mileage: "",
    condition: "good",
    transmission: "",
    price: "",
    location: "",
    phone: "",
    description: "",
    featured: false,
  });
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryProgress, setGalleryProgress] = useState<UploadProgress[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoProgress, setVideoProgress] = useState<UploadProgress | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoapifyPlace[]>([]);
  const [isFetching, setIsFetching] = useState(false);


  // ---- Fetch Dashboard Stats & Pending Cars ----
  const fetchDashboardData = async () => {
    try {
      const { data: listings } = await supabase
        .from("cars")
        .select("*, dealers(full_name, company_name, email)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      setPendingListings(listings || []);

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

  // ---- Approve / Reject Listing ----
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

  // ---- Cloudinary Upload ----
  const uploadWithProgress = (
    file: File,
    resourceType: "image" | "video",
    onProgress: (progress: number) => void
  ): Promise<string> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } else reject(new Error("Upload failed"));
      };
      xhr.onerror = () => reject(new Error("Network error"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      xhr.send(fd);
    });

  // ---- Submit Car ----
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.make || !form.model || !form.price || galleryFiles.length === 0) {
      toast({
        title: "Missing required fields",
        description: "Please complete all required inputs and upload at least one photo.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Upload gallery
      const uploads = await Promise.all(
        galleryFiles.map((file) =>
          uploadWithProgress(file, "image", (progress) =>
            setGalleryProgress((prev) => {
              const existing = prev.find((p) => p.fileName === file.name);
              if (existing) {
                return prev.map((p) =>
                  p.fileName === file.name ? { ...p, progress } : p
                );
              }
              return [...prev, { fileName: file.name, progress }];
            })
          )
        )
      );

      const galleryUrls = uploads;

      // Upload video if any
      let videoUrl: string | null = null;
      if (videoFile) {
        if (videoFile.size > 20 * 1024 * 1024) throw new Error("Video exceeds 20MB limit.");
        videoUrl = await uploadWithProgress(videoFile, "video", (progress) =>
          setVideoProgress({ fileName: videoFile.name, progress })
        );
      }

      const insert: CarInsert = {
        make: form.make,
        model: form.model,
        year: Number(form.year),
        price: Number(form.price),
        mileage: Number(form.mileage),
        location: form.location,
        description: form.description,
        condition: form.condition,
        transmission: form.transmission,
        phone: form.phone,
        gallery: galleryUrls,
        video_url: videoUrl,
        featured: form.featured,
        status: "active",
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("cars").insert([insert]);
      if (error) throw error;

      toast({ title: "✅ Vehicle added successfully!" });
      fetchDashboardData();

      // Reset form
      setForm({
        make: "",
        model: "",
        year: "",
        mileage: "",
        condition: "good",
        transmission: "",
        price: "",
        location: "",
        phone: "",
        description: "",
        featured: false,
      });
      setGalleryFiles([]);
      setVideoFile(null);
      setGalleryProgress([]);
      setVideoProgress(null);
      setStep(1);
    } catch (err: any) {
      toast({
        title: "❌ Upload failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ---- Geoapify Location Suggestions ----
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
        const formattedResults =
          data.features?.map((f: any) => ({
            formatted: f.properties.formatted,
            place_id: f.properties.place_id,
          })) || [];
        setSuggestions(formattedResults);
      } catch {
        setSuggestions([]);
      } finally {
        setIsFetching(false);
      }
    };
    const timeout = setTimeout(fetchSuggestions, 400);
    return () => clearTimeout(timeout);
  }, [locationQuery]);

  // ---- Lightbox ----
  const openLightbox = (images: string[]) => {
    setLightboxImages(images);
    setCurrentIndex(0);
    setLightboxOpen(true);
  };
  const nextImage = () => setCurrentIndex((prev) => (prev + 1) % lightboxImages.length);
  const prevImage = () =>
    setCurrentIndex((prev) => (prev === 0 ? lightboxImages.length - 1 : prev - 1));

  // ---- Render ----
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pt-24 pb-16 container mx-auto px-4">
        <h1 className="font-heading font-bold text-4xl mb-8">Admin Dashboard</h1>

        {/* 🧮 Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6"><p>Total Listings: {stats.totalListings}</p></Card>
          <Card className="p-6"><p>Pending Approval: {stats.pendingApproval}</p></Card>
          <Card className="p-6"><p>Total Dealers: {stats.totalDealers}</p></Card>
          <Card className="p-6"><p>Total Revenue: KES {stats.totalRevenue.toLocaleString()}</p></Card>
        </div>

        {/* 🆕 Admin Add Car */}
        <Card className="p-6 mb-10">
          <h2 className="font-heading text-2xl font-bold mb-6 flex items-center gap-2">
            <Car className="text-primary w-6 h-6" /> Add New Vehicle
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Make</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></div>
              <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
              <div><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
              <div><Label>Mileage (km)</Label><Input type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} /></div>
            </div>

            {/* Upload Section */}
            <div>
              <Label>Upload Photos</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer"
                onClick={() => document.getElementById("gallery-input")?.click()}
              >
                <Upload className="mx-auto text-gray-400" />
                <p>Click or drag & drop images</p>
                <input id="gallery-input" type="file" accept="image/*" multiple hidden onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))} />
              </div>

              {galleryProgress.map((p) => (
                <div key={p.fileName} className="mt-2">
                  <p className="text-sm">{p.fileName}</p>
                  <div className="h-2 bg-gray-200 rounded">
                    <div className="h-2 bg-blue-600 rounded" style={{ width: `${p.progress}%` }}></div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label>Upload Video (optional)</Label>
              <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
              {videoProgress && (
                <div className="mt-2">
                  <p className="text-sm">{videoProgress.fileName}</p>
                  <div className="h-2 bg-gray-200 rounded">
                    <div className="h-2 bg-green-600 rounded" style={{ width: `${videoProgress.progress}%` }}></div>
                  </div>
                </div>
              )}
            </div>

            <Label>Price (KES)</Label>
            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />

            <Label>Location</Label>
            <Input
              value={locationQuery || form.location}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="Search location..."
            />
            {isFetching && <p className="text-sm text-muted-foreground">Fetching suggestions...</p>}
            {suggestions.length > 0 && (
              <div className="bg-white border rounded shadow mt-1 max-h-48 overflow-y-auto">
                {suggestions.map((s) => (
                  <div
                    key={s.place_id}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => {
                      setForm({ ...form, location: s.formatted });
                      setLocationQuery(s.formatted);
                      setSuggestions([]);
                    }}
                  >
                    {s.formatted}
                  </div>
                ))}
              </div>
            )}

            <Label>Phone</Label>
            <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              <Label className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500" /> Feature this car
              </Label>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Uploading..." : "Add Vehicle"}
            </Button>
          </form>
        </Card>

        {/* 🚗 Pending Listings */}
        <Card className="p-6">
          <h2 className="font-heading font-bold text-2xl mb-6">Pending Listings</h2>
          {pendingListings.length === 0 ? (
            <p className="text-muted-foreground">No pending listings.</p>
          ) : (
            pendingListings.map((car) => (
              <div key={car.id} className="flex justify-between border p-3 rounded mb-2">
                <div>
                  <h3>{car.make} {car.model}</h3>
                  <p>{car.location}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleApproval(car.id, "active")} className="bg-green-500 hover:bg-green-600">
                    Approve
                  </Button>
                  <Button variant="destructive" onClick={() => handleApproval(car.id, "removed")}>
                    Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>
      </main>

      {/* 🖼️ Lightbox */}
      <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)}>
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="relative max-w-4xl w-full p-4">
            <img src={lightboxImages[currentIndex]} alt="Gallery" className="w-full rounded-lg" />
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
