// frontend/src/pages/DealerDashboard.tsx
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Car,
  MessageSquare,
  TrendingUp,
  Plus,
  Edit,
  AlertCircle,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  full_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  location?: string;
}

export interface Listing {
  id: number;
  dealer_id?: string | null;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  condition: string;
  location: string;
  description: string;
  phone: string;
  status: "pending" | "active" | "removed" | "archived";
  created_at?: string;
  gallery?: string[] | null;
  video_url?: string | null;
  transmission?: string | null;
}

type ListingPayload = Partial<
  Omit<Listing, "id" | "created_at"> & { status?: Listing["status"] }
>;

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

interface UploadProgress {
  fileName: string;
  progress: number;
  url?: string;
}

interface GeoapifyPlace {
  formatted: string;
  place_id: string;
}

/* ============================
   Config
   ============================ */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;
const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string;
const MAX_GALLERY = 8;

/* ============================
   Component
   ============================ */

const DealerDashboard: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const userRole = user?.role;

  // Core data
  const [dealerProfile, setDealerProfile] = useState<Dealer | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  // Trial
  const [trialInfo, setTrialInfo] = useState<TrialInfo>({ trialEnd: null, expired: false });
  const [remainingTime, setRemainingTime] = useState<string>("");

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Wizard state (works for both create & edit)
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
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

  // Gallery / upload
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]); // newly selected files
  const [galleryProgress, setGalleryProgress] = useState<UploadProgress[]>([]);
  const [existingGallery, setExistingGallery] = useState<string[]>([]); // URLs from DB while editing
  const [removedImages, setRemovedImages] = useState<string[]>([]); // removed during edit, not saved yet
  const [newUploadedUrls, setNewUploadedUrls] = useState<string[]>([]);
  const [replaceMode, setReplaceMode] = useState<"replace" | "append" | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState<boolean>(false);

  // Video (optional)
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoProgress, setVideoProgress] = useState<UploadProgress | null>(null);

  // Geoapify
  const [locationQuery, setLocationQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<GeoapifyPlace[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  // Which listing is being edited (null = create)
  const [activeEditListing, setActiveEditListing] = useState<Listing | null>(null);

  /* -------------------------
     Helper: fetch dealer + listings + subscription
     ------------------------- */
  const fetchDealerData = useCallback(async () => {
    try {
      const { data: profile, error: profileErr } = await supabase
        .from<Dealer>("dealers")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (profileErr) {
        console.error("Dealer fetch error", profileErr);
        setDealerProfile(null);
      } else {
        setDealerProfile(profile ?? null);
      }

      if (profile) {
        const { data: carsData, error: carsErr } = await supabase
          .from<Listing>("cars")
          .select("*")
          .eq("dealer_id", profile.id)
          .order("created_at", { ascending: false });

        if (carsErr) {
          console.error("Cars fetch error", carsErr);
          setListings([]);
        } else {
          setListings(carsData ?? []);
        }

        const { data: subData, error: subErr } = await supabase
          .from<Subscription>("dealer_subscriptions")
          .select("*")
          .eq("dealer_id", profile.id)
          .eq("status", "active")
          .maybeSingle();

        if (subErr) console.error("Subscription fetch error", subErr);
        else setSubscription(subData ?? null);
      }
    } catch (err) {
      console.error("fetchDealerData error", err);
      toast({ title: "Error", description: "Failed to load dealer data", variant: "destructive" });
    }
  }, [toast, user?.id]);

  /* -------------------------
     Fetch trial info
     ------------------------- */
  const fetchTrialInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<{ trial_end: string | null }>("users")
        .select("trial_end")
        .eq("id", user?.id)
        .single();

      if (error) throw error;
      if (data?.trial_end) {
        const end = new Date(data.trial_end);
        setTrialInfo({ trialEnd: end.toISOString(), expired: end <= new Date() });
      }
    } catch (_err) {
      // non-fatal
      console.error("Error fetching trial info", _err);
    }
  }, [user?.id]);

  /* -------------------------
     Redirect non-dealer
     ------------------------- */
  useEffect(() => {
    if (!isLoading && (!user || userRole !== "dealer")) {
      navigate("/login");
    }
  }, [isLoading, user, userRole, navigate]);

  /* -------------------------
     Initial load
     ------------------------- */
  useEffect(() => {
    if (user && userRole === "dealer") {
      fetchDealerData();
      fetchTrialInfo();
    }
  }, [user, userRole, fetchDealerData, fetchTrialInfo]);

  /* -------------------------
     Trial countdown
     ------------------------- */
  useEffect(() => {
    if (!trialInfo.trialEnd) return;
    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date(trialInfo.trialEnd as string);
      if (end <= now) {
        setTrialInfo((p) => ({ ...p, expired: true }));
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

  /* ============================
     Wizard validation & navigation
     ============================ */
  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!form.make.trim()) newErrors.make = "Make is required";
      if (!form.model.trim()) newErrors.model = "Model is required";
      if (!form.year.trim()) newErrors.year = "Year is required";
      if (!form.mileage.trim()) newErrors.mileage = "Mileage is required";
    }
    if (step === 2) {
      const hasExisting = existingGallery.length > 0 && removedImages.length < (existingGallery?.length ?? 0);
      if (!hasExisting && galleryFiles.length === 0) newErrors.gallery = "Please upload at least one photo";
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

  const handleNext = (): void => {
    if (validateStep()) setStep((s) => s + 1);
  };

  /* ============================
     Cloudinary upload helpers
     ============================ */
  const uploadWithProgress = (
    file: File,
    onProgress: (progress: number) => void,
    resourceType: "image" | "video" = "image"
  ): Promise<string> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
      xhr.open("POST", endpoint);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const progress = Math.round((ev.loaded / ev.total) * 100);
          onProgress(progress);
        }
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data.secure_url as string);
          } catch (err) {
            reject(new Error("Invalid upload response"));
          }
        } else {
          reject(new Error("Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      xhr.send(fd);
    });

  /* ============================
     Submit (create or update)
     ============================ */
  const handleSubmit = async (evt?: React.FormEvent<HTMLFormElement>) => {
    if (evt) evt.preventDefault();
    if (!dealerProfile) {
      toast({ title: "Error", description: "Please set up your dealer profile first.", variant: "destructive" });
      return;
    }
    if (subscription?.listing_limit && listings.length >= subscription.listing_limit && !activeEditListing) {
      toast({ title: "Listing Limit Reached", description: "Upgrade your plan to add more listings.", variant: "destructive" });
      return;
    }
    if (!validateStep()) return;

    setLoading(true);
    try {
      // Upload new gallery files (if any)
      const uploadedGalleryUrls: string[] = [];
      if (galleryFiles.length > 0) {
        setGalleryProgress(galleryFiles.map((f) => ({ fileName: f.name, progress: 0 })));
        const uploads = await Promise.all(
          galleryFiles.slice(0, MAX_GALLERY).map((file) =>
            uploadWithProgress(file, (p) =>
              setGalleryProgress((prev) => prev.map((item) => (item.fileName === file.name ? { ...item, progress: p } : item)))
            )
          )
        );
        uploadedGalleryUrls.push(...uploads);
        setNewUploadedUrls(uploads);
      }

      // Video upload (optional)
      let uploadedVideoUrl: string | null = null;
      if (videoFile) {
        if (videoFile.size > 20 * 1024 * 1024) throw new Error("Video exceeds 20MB limit.");
        setVideoProgress({ fileName: videoFile.name, progress: 0 });
        uploadedVideoUrl = await uploadWithProgress(videoFile, (p) => setVideoProgress({ fileName: videoFile.name, progress: p }), "video");
      }

      // Determine final gallery
      let finalGallery: string[] = [];
      if (activeEditListing) {
        // editing
        if (uploadedGalleryUrls.length > 0) {
          // user uploaded new images -> decide based on replaceMode
          const mode = replaceMode ?? "append"; // safe fallback
          if (mode === "replace") {
            finalGallery = uploadedGalleryUrls.slice(0, MAX_GALLERY);
          } else {
            finalGallery = [...existingGallery, ...uploadedGalleryUrls].slice(0, MAX_GALLERY);
          }
        } else {
          // no new uploads, use current existingGallery
          finalGallery = existingGallery.slice(0, MAX_GALLERY);
        }
      } else {
        // create flow
        finalGallery = uploadedGalleryUrls.slice(0, MAX_GALLERY);
      }

      const payload: ListingPayload = {
        dealer_id: dealerProfile.id,
        make: form.make,
        model: form.model,
        year: form.year ? Number(form.year) : undefined,
        price: form.price ? Number(form.price) : undefined,
        mileage: form.mileage ? Number(form.mileage) : undefined,
        location: form.location,
        description: form.description,
        condition: form.condition,
        transmission: form.transmission || null,
        phone: form.phone,
        gallery: finalGallery.length > 0 ? finalGallery : null,
        video_url: uploadedVideoUrl ?? null,
        status: "pending",
        created_at: new Date().toISOString(),
      };

      if (activeEditListing) {
        const updatePayload: ListingPayload = {
          make: payload.make,
          model: payload.model,
          year: payload.year,
          price: payload.price,
          mileage: payload.mileage,
          location: payload.location,
          description: payload.description,
          condition: payload.condition,
          transmission: payload.transmission,
          phone: payload.phone,
          status: payload.status,
        };
        if (payload.gallery !== null) updatePayload.gallery = payload.gallery;
        if (payload.video_url !== null) updatePayload.video_url = payload.video_url;

        const { error } = await supabase.from("cars").update(updatePayload).eq("id", activeEditListing.id);
        if (error) throw error;

        toast({ title: "Success", description: "Listing updated successfully!" });
        setIsEditOpen(false);
        setActiveEditListing(null);
      } else {
        const { error } = await supabase.from("cars").insert([payload]);
        if (error) throw error;

        toast({ title: "Success", description: "Listing submitted for admin approval!" });
        setIsCreateOpen(false);
      }

      // reset wizard
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
      });
      setGalleryFiles([]);
      setGalleryProgress([]);
      setExistingGallery([]);
      setRemovedImages([]);
      setNewUploadedUrls([]);
      setReplaceMode(null);
      setShowReplaceConfirm(false);
      setVideoFile(null);
      setVideoProgress(null);
      setStep(1);

      // refresh listings
      fetchDealerData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed.";
      console.error("Submit error", err);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /* ============================
     Geoapify autocomplete with caching (basic)
     ============================ */
  useEffect(() => {
    let cancelled = false;
    if (!locationQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsFetching(true);
      try {
        // try local cache (location_cache table)
        const { data: cached } = await supabase
          .from<{ display_name: string; created_at: string }>("location_cache")
          .select("display_name, created_at")
          .ilike("query", locationQuery)
          .limit(5);

        if (cached && cached.length > 0) {
          const mapped = cached.map((r) => ({ formatted: r.display_name, place_id: r.display_name }));
          if (!cancelled) setSuggestions(mapped);
          setIsFetching(false);
          return;
        }

        // fetch remote
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(locationQuery)}&limit=5&apiKey=${GEOAPIFY_API_KEY}`
        );
        const data = await res.json();

        const features = Array.isArray(data.features) ? data.features : [];
        const formattedResults: GeoapifyPlace[] = features.map((f: unknown) => {
          const obj = f as { properties?: { formatted?: string; place_id?: string } };
          return {
            formatted: obj.properties?.formatted ?? "",
            place_id: obj.properties?.place_id ?? Math.random().toString(36).slice(2),
          };
        });

        if (!cancelled) setSuggestions(formattedResults);

        // cache some results (best-effort)
        if (formattedResults.length > 0) {
          const inserts = formattedResults.map((r) => ({
            query: locationQuery,
            display_name: r.formatted,
            created_at: new Date().toISOString(),
          }));
          // silently attempt insert
          await supabase.from("location_cache").insert(inserts).select();
        }
      } catch (err) {
        console.error("Geoapify error", err);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locationQuery]);

  /* ============================
     Edit flow helpers
     ============================ */
  const openEditWizard = (listing: Listing): void => {
    setActiveEditListing(listing);
    setExistingGallery(listing.gallery ?? []);
    setRemovedImages([]);
    setGalleryFiles([]);
    setGalleryProgress([]);
    setNewUploadedUrls([]);
    setReplaceMode(null);
    setShowReplaceConfirm(false);
    setForm({
      make: listing.make,
      model: listing.model,
      year: String(listing.year ?? ""),
      mileage: String(listing.mileage ?? ""),
      condition: listing.condition ?? "good",
      transmission: listing.transmission ?? "",
      price: String(listing.price ?? ""),
      location: listing.location ?? "",
      phone: listing.phone ?? "",
      description: listing.description ?? "",
    });
    setStep(1);
    setIsEditOpen(true);
  };

  const handleRemoveExistingImage = (url: string): void => {
    setRemovedImages((p) => [...p, url]);
    setExistingGallery((p) => p.filter((u) => u !== url));
  };

  const handleRestoreExistingImage = (url: string): void => {
    setRemovedImages((p) => p.filter((u) => u !== url));
    setExistingGallery((p) => [...p, url]);
  };

  const handleSelectNewFiles = (files: File[]): void => {
    const limited = files.slice(0, MAX_GALLERY);
    setGalleryFiles(limited);
    setGalleryProgress(limited.map((f) => ({ fileName: f.name, progress: 0 })));
    if (activeEditListing && existingGallery.length > 0) {
      setShowReplaceConfirm(true);
      setReplaceMode(null);
    } else if (!activeEditListing) {
      setReplaceMode("replace");
    } else {
      setReplaceMode("replace");
    }
  };

  /* ============================
     Stats computed
     ============================ */
  const stats = {
    totalListings: listings.length,
    approvedListings: listings.filter((l) => l.status === "active").length,
    pendingListings: listings.filter((l) => l.status === "pending").length,
  };

  /* ============================
     Render
     ============================ */
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user || userRole !== "dealer") return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Trial Banner */}
      {trialInfo.trialEnd && (
        <div className={`p-4 flex items-center justify-between border-b ${trialInfo.expired ? "bg-red-100 border-red-300 text-red-700" : "bg-yellow-100 border-yellow-300 text-yellow-800"}`}>
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <div>
              {trialInfo.expired ? (
                <p className="font-semibold">⏳ Your free trial has ended. Upgrade to continue using dealer features.</p>
              ) : (
                <p className="font-semibold">🚀 Free Trial Active — <span className="text-primary">{remainingTime}</span> remaining</p>
              )}
            </div>
          </div>
          {trialInfo.expired && <Button onClick={() => navigate("/pricing")} className="bg-primary text-white">Upgrade Now</Button>}
        </div>
      )}

      <div className="pt-24 pb-16 container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-heading font-bold text-4xl">Dealer Dashboard</h1>
          <div className="flex items-center gap-3">
            <Button className="gradient-hero" onClick={() => { setIsCreateOpen(true); setActiveEditListing(null); setExistingGallery([]); setGalleryFiles([]); setStep(1); }}>
              <Plus className="w-4 h-4 mr-2" /> Add Listing
            </Button>
          </div>
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

        {/* Listings list */}
        <div className="grid gap-4">
          {listings.map((l) => (
            <Card key={l.id} className="p-4 flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-28 h-20 bg-gray-100 rounded overflow-hidden">
                  {l.gallery && l.gallery.length > 0 ? (
                    <img src={l.gallery[0]} alt={`${l.make}-${l.model}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">No Image</div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold">{l.make} {l.model} <span className="text-sm text-muted-foreground">({l.year})</span></h3>
                  <p className="text-sm text-muted-foreground">{l.location} • {l.mileage} km</p>
                  <p className="mt-2 text-sm">{l.description?.slice(0, 160)}{l.description && l.description.length > 160 ? "..." : ""}</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  <p className="font-semibold">KES {Number(l.price).toLocaleString()}</p>
                  <Badge>{l.status}</Badge>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => openEditWizard(l)} className="flex items-center gap-2">
                    <Edit className="w-4 h-4" /> Edit
                  </Button>
                  <Button variant="ghost" onClick={async () => {
                    if (!confirm("Delete listing?")) return;
                    const { error } = await supabase.from("cars").delete().eq("id", l.id);
                    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
                    else { toast({ title: "Deleted", description: "Listing removed." }); fetchDealerData(); }
                  }}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* CREATE / EDIT WIZARD DIALOG */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setIsEditOpen(false);
          setActiveEditListing(null);
          setExistingGallery([]);
          setGalleryFiles([]);
          setNewUploadedUrls([]);
          setReplaceMode(null);
          setShowReplaceConfirm(false);
          setStep(1);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeEditListing ? "Edit Listing" : "Post Your Vehicle"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 p-4">
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-4 mb-6">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${s === step ? "gradient-hero text-primary-foreground" : s < step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s}</div>
                  {s < 3 && <div className="w-12 h-1 bg-muted" />}
                </div>
              ))}
            </div>

            {/* Step 1: Basic Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Make *</Label>
                    <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Toyota" />
                    {errors.make && <p className="text-red-500 text-sm">{errors.make}</p>}
                  </div>

                  <div>
                    <Label>Model *</Label>
                    <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Corolla" />
                    {errors.model && <p className="text-red-500 text-sm">{errors.model}</p>}
                  </div>

                  <div>
                    <Label>Year *</Label>
                    <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} min={1990} max={new Date().getFullYear()} />
                    {errors.year && <p className="text-red-500 text-sm">{errors.year}</p>}
                  </div>

                  <div>
                    <Label>Mileage (km) *</Label>
                    <Input type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} />
                    {errors.mileage && <p className="text-red-500 text-sm">{errors.mileage}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Photos & description */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label>Upload Photos * (max {MAX_GALLERY})</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-smooth cursor-pointer" onClick={() => document.getElementById("gallery-input")?.click()}>
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-2">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB each (Max {MAX_GALLERY} photos)</p>
                    <input id="gallery-input" type="file" accept="image/*" multiple hidden onChange={(e) => handleSelectNewFiles(Array.from(e.target.files ?? []))} />
                  </div>

                  {errors.gallery && <p className="text-red-500 text-sm mt-2">{errors.gallery}</p>}

                  {/* Existing gallery previews */}
                  {existingGallery.length > 0 && galleryFiles.length === 0 && (
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      {existingGallery.map((url, idx) => (
                        <div key={idx} className="relative">
                          <img src={url} alt={`existing-${idx}`} className="w-full h-28 object-cover rounded" />
                          <button type="button" className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs" onClick={() => handleRemoveExistingImage(url)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Removed images (can restore) */}
                  {removedImages.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-muted-foreground">Removed (can restore)</p>
                      <div className="flex gap-2 mt-2">
                        {removedImages.map((url, i) => (
                          <div key={i} className="text-center">
                            <img src={url} alt={`removed-${i}`} className="w-20 h-12 object-cover rounded" />
                            <button type="button" className="block mt-1 text-xs" onClick={() => handleRestoreExistingImage(url)}>Restore</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Newly selected files preview */}
                  {galleryFiles.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      {galleryFiles.map((f, i) => (
                        <div key={i} className="relative">
                          <img src={URL.createObjectURL(f)} alt={`new-${i}`} className="w-full h-28 object-cover rounded" />
                          {galleryProgress.find((p) => p.fileName === f.name) && (
                            <div className="absolute left-0 right-0 bottom-0 bg-black/40 p-1 rounded-b">
                              <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
                                <div style={{ width: `${galleryProgress.find((p) => p.fileName === f.name)?.progress ?? 0}%` }} className="h-2 transition-all" />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Description *</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={6} />
                  {errors.description && <p className="text-red-500 text-sm">{errors.description}</p>}
                </div>
              </div>
            )}

            {/* Step 3: Contact & price */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label>Price (KES) *</Label>
                  <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  {errors.price && <p className="text-red-500 text-sm">{errors.price}</p>}
                </div>

                <div className="relative">
                  <Label>Location *</Label>
                  <Input value={locationQuery || form.location} onChange={(e) => setLocationQuery(e.target.value)} placeholder="Start typing your location..." />
                  {isFetching && <p className="text-sm text-muted-foreground mt-1">Fetching...</p>}
                  {suggestions.length > 0 && (
                    <div className="absolute bg-white shadow rounded mt-1 border border-gray-200 w-full max-h-48 overflow-y-auto z-20">
                      {suggestions.map((s) => (
                        <div key={s.place_id} className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => { setForm({ ...form, location: s.formatted }); setLocationQuery(s.formatted); setSuggestions([]); }}>
                          {s.formatted}
                        </div>
                      ))}
                    </div>
                  )}
                  {errors.location && <p className="text-red-500 text-sm">{errors.location}</p>}
                </div>

                <div>
                  <Label>Phone Number *</Label>
                  <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254 700 000 000" />
                  {errors.phone && <p className="text-red-500 text-sm">{errors.phone}</p>}
                </div>
              </div>
            )}

            {/* Replace/Append confirm */}
            {showReplaceConfirm && (
              <div className="p-3 border rounded bg-yellow-50">
                <p className="font-semibold">New images detected</p>
                <p className="text-sm">Replace existing images or append new ones to the gallery?</p>
                <div className="flex gap-2 mt-2">
                  <Button type="button" onClick={() => { setReplaceMode("replace"); setShowReplaceConfirm(false); }}>Replace</Button>
                  <Button type="button" variant="outline" onClick={() => { setReplaceMode("append"); setShowReplaceConfirm(false); }}>Append</Button>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-4">
              {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="flex-1">Previous</Button>}
              {step < 3 ? (
                <Button type="button" onClick={handleNext} className="flex-1">Next Step</Button>
              ) : (
                <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Submitting..." : (activeEditListing ? "Update Listing" : "Submit Listing")}</Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DealerDashboard;
