import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/db";

type CarInsert = Database["public"]["Tables"]["cars"]["Insert"];

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

interface UploadProgress {
  fileName: string;
  progress: number;
  url?: string;
}

interface GeoapifyPlace {
  formatted: string;
  place_id: string;
}

const PostVehicle: React.FC = () => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
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
  });

  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryProgress, setGalleryProgress] = useState<UploadProgress[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoProgress, setVideoProgress] = useState<UploadProgress | null>(null);

  // 🌍 Location autocomplete state
  const [locationQuery, setLocationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoapifyPlace[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // 🧩 Step validation
  const validateStep = () => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!form.make.trim()) newErrors.make = "Make is required";
      if (!form.model.trim()) newErrors.model = "Model is required";
      if (!form.year.trim()) newErrors.year = "Year is required";
      if (!form.mileage.trim()) newErrors.mileage = "Mileage is required";
    }

    if (step === 2) {
      if (galleryFiles.length === 0) newErrors.gallery = "Please upload at least one photo";
      if (!form.description.trim()) newErrors.description = "Description is required";
    }

    if (step === 3) {
      if (!form.price.trim()) newErrors.price = "Price is required";
      if (!form.location.trim()) newErrors.location = "Location is required";
      if (!form.phone.trim()) newErrors.phone = "Phone number is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 🧠 Geoapify Autocomplete + Supabase Cache (24-hour expiry)
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!locationQuery.trim()) {
        setSuggestions([]);
        return;
      }

      setIsFetching(true);

      try {
        // 🧾 Check cache
        const { data: cached } = await supabase
          .from("locations")
          .select("results, created_at")
          .eq("query", locationQuery)
          .maybeSingle();

        if (cached) {
          const cachedTime = new Date(cached.created_at).getTime();
          const now = Date.now();
          const diffHours = (now - cachedTime) / (1000 * 60 * 60);

          if (diffHours < 24) {
            // ✅ Use cached data if less than 24h old
            setSuggestions(cached.results || []);
            setIsFetching(false);
            return;
          } else {
            // 🗑️ Delete old cache
            await supabase.from("locations").delete().eq("query", locationQuery);
          }
        }

        // 🌐 Fetch from Geoapify
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

        // 💾 Cache new data
        await supabase.from("locations").upsert({
          query: locationQuery,
          results: formattedResults,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("❌ Geoapify error:", err);
      } finally {
        setIsFetching(false);
      }
    };

    const timeout = setTimeout(fetchSuggestions, 400); // debounce
    return () => clearTimeout(timeout);
  }, [locationQuery]);

  // 📸 Upload with progress
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

  // 🧾 Submit Handler
const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (!validateStep()) return;

  setLoading(true);
  try {
    const galleryUrls: string[] = [];
    if (galleryFiles.length > 0) {
      const uploads = await Promise.all(
        galleryFiles.map((file) =>
          uploadWithProgress(file, "image", (progress) => {
            setGalleryProgress((prev) =>
              prev.map((p) => (p.fileName === file.name ? { ...p, progress } : p))
            );
          })
        )
      );
      galleryUrls.push(...uploads);
    }

    let videoUrl: string | null = null;
    if (videoFile) {
      if (videoFile.size > 20 * 1024 * 1024) throw new Error("Video exceeds 20MB limit.");
      videoUrl = await uploadWithProgress(videoFile, "video", (progress) =>
        setVideoProgress({ fileName: videoFile.name, progress })
      );
    }

    // 🧩 Save all entered data temporarily before payment
    const pendingCar = {
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
      featured: false,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    localStorage.setItem("pendingCar", JSON.stringify(pendingCar));

    toast({
      title: "Almost done!",
      description: "Please select a plan to complete your listing.",
    });

    // 🧭 Redirect user to pricing page
    window.location.href = "/pricing";
  } catch (err: any) {
    console.error("❌ Submission error:", err);
    toast({
      title: "Error",
      description: err.message || "Submission failed.",
    });
  } finally {
    setLoading(false);
  }
};


  const handleNext = () => {
    if (validateStep()) setStep((s) => s + 1);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 rounded-full gradient-hero mb-4">
              <Car className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">
              Post Your <span className="text-primary">Vehicle</span>
            </h1>
            <p className="text-muted-foreground">
              Fill in the details below to list your car for sale
            </p>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-smooth ${
                    s === step
                      ? "gradient-hero text-primary-foreground"
                      : s < step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s}
                </div>
                {s < 3 && <div className="w-12 h-1 bg-muted" />}
              </div>
            ))}
          </div>

          <Card className="shadow-card-hover">
            <CardHeader>
              <h2 className="font-heading text-xl font-semibold">
                {step === 1 && "Vehicle Information"}
                {step === 2 && "Photos & Description"}
                {step === 3 && "Contact & Pricing"}
              </h2>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Step 1 */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Make *</Label>
                        <Input
                          value={form.make}
                          onChange={(e) => setForm({ ...form, make: e.target.value })}
                          placeholder="e.g., Toyota"
                        />
                        {errors.make && <p className="text-red-500 text-sm">{errors.make}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Model *</Label>
                        <Input
                          value={form.model}
                          onChange={(e) => setForm({ ...form, model: e.target.value })}
                          placeholder="e.g., Corolla"
                        />
                        {errors.model && <p className="text-red-500 text-sm">{errors.model}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Year *</Label>
                        <Input
                          type="number"
                          value={form.year}
                          onChange={(e) => setForm({ ...form, year: e.target.value })}
                          placeholder="2020"
                          min="1990"
                          max="2025"
                        />
                        {errors.year && <p className="text-red-500 text-sm">{errors.year}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Mileage (km) *</Label>
                        <Input
                          type="number"
                          value={form.mileage}
                          onChange={(e) => setForm({ ...form, mileage: e.target.value })}
                          placeholder="50000"
                        />
                        {errors.mileage && <p className="text-red-500 text-sm">{errors.mileage}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2 */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Upload Photos *</Label>
                      <div
                        className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-smooth cursor-pointer"
                        onClick={() => document.getElementById("gallery-input")?.click()}
                      >
                        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG up to 10MB (Max 8 photos)
                        </p>
                        <input
                          id="gallery-input"
                          type="file"
                          accept="image/*"
                          multiple
                          hidden
                          onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))}
                        />
                      </div>
                      {errors.gallery && <p className="text-red-500 text-sm">{errors.gallery}</p>}

                      {galleryFiles.length > 0 && (
                        <div className="grid grid-cols-3 gap-3 mt-3">
                          {galleryFiles.map((file, i) => (
                            <img
                              key={i}
                              src={URL.createObjectURL(file)}
                              alt="preview"
                              className="w-full h-28 object-cover rounded"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Description *</Label>
                      <Textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Describe your vehicle's features, condition, etc."
                        rows={6}
                      />
                      {errors.description && (
                        <p className="text-red-500 text-sm">{errors.description}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3 */}
                {step === 3 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Price (KES) *</Label>
                      <Input
                        type="number"
                        value={form.price}
                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                        placeholder="3500000"
                      />
                      {errors.price && <p className="text-red-500 text-sm">{errors.price}</p>}
                    </div>

                    <div className="space-y-2 relative">
                      <Label>Location *</Label>
                      <Input
                        type="text"
                        value={locationQuery || form.location}
                        onChange={(e) => setLocationQuery(e.target.value)}
                        placeholder="Start typing your location..."
                      />
                      {isFetching && (
                        <p className="text-sm text-muted-foreground mt-1">Fetching...</p>
                      )}

                      {suggestions.length > 0 && (
                        <div className="absolute bg-white shadow rounded mt-1 border border-gray-200 w-full max-h-48 overflow-y-auto z-20">
                          {suggestions.map((s) => (
                            <div
                              key={s.place_id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
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
                      {errors.location && <p className="text-red-500 text-sm">{errors.location}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Phone Number *</Label>
                      <Input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+254 700 000 000"
                      />
                      {errors.phone && <p className="text-red-500 text-sm">{errors.phone}</p>}
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex gap-4">
                  {step > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(step - 1)}
                      className="flex-1"
                    >
                      Previous
                    </Button>
                  )}
                  {step < 3 ? (
                    <Button type="button" variant="hero" onClick={handleNext} className="flex-1">
                      Next Step
                    </Button>
                  ) : (
                    <Button type="submit" variant="hero" className="flex-1" disabled={loading}>
                      {loading ? "Submitting..." : "Submit Listing"}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PostVehicle;
