// ==========================================================================
// DealerDashboard (Updated for Express Backend)
// ==========================================================================
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Car, Plus, Edit } from "lucide-react";
import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
} from "date-fns";

// ==========================================================================
// TYPES
// ==========================================================================
interface Dealer {
  id: string;
  user_id: string;
  full_name?: string;
  company_name?: string;
  phone?: string;
  email?: string;
  location?: string;
}

interface Listing {
  id: number;
  dealer_id?: string;
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
  gallery?: string[];
  video_url?: string | null;
  created_at?: string;
}

interface UploadProgress {
  fileName: string;
  progress: number;
}

// ==========================================================================
// CONFIG
// ==========================================================================
const MAX_GALLERY = 8;
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// ==========================================================================
// Cloudinary Upload
// ==========================================================================
async function uploadCloudinary(
  file: File,
  onProgress: (p: number) => void,
  resource: "image" | "video" = "image"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resource}/upload`
    );

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200)
        resolve(JSON.parse(xhr.responseText).secure_url);
      else reject(new Error("Upload failed"));
    };

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    xhr.send(fd);
  });
}

// ==========================================================================
// Listing Wizard Component (Updated for Express backend)
// ==========================================================================
function ListingWizard({
  open,
  onClose,
  dealer,
  listing,
  onSubmitComplete,
}: {
  open: boolean;
  onClose: () => void;
  dealer: Dealer | null;
  listing: Listing | null;
  onSubmitComplete: () => void;
}) {
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    make: listing?.make ?? "",
    model: listing?.model ?? "",
    year: listing?.year?.toString() ?? "",
    mileage: listing?.mileage?.toString() ?? "",
    condition: listing?.condition ?? "good",
    price: listing?.price?.toString() ?? "",
    phone: listing?.phone ?? dealer?.phone ?? "",
    location: listing?.location ?? "",
    description: listing?.description ?? "",
  });

  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<string[]>(listing?.gallery ?? []);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setGalleryFiles([]);
      setExisting(listing?.gallery ?? []);
      setVideoFile(null);
      setForm({
        make: listing?.make ?? "",
        model: listing?.model ?? "",
        year: listing?.year?.toString() ?? "",
        mileage: listing?.mileage?.toString() ?? "",
        condition: listing?.condition ?? "good",
        price: listing?.price?.toString() ?? "",
        phone: listing?.phone ?? dealer?.phone ?? "",
        location: listing?.location ?? "",
        description: listing?.description ?? "",
      });
    }
  }, [open]);

  // ------------------------------------------------------------
  // VALIDATE
  // ------------------------------------------------------------
  const validate = () => {
    if (step === 1) {
      if (!form.make || !form.model) return false;
    }
    if (step === 2) {
      if (existing.length === 0 && galleryFiles.length === 0) return false;
    }
    if (step === 3) {
      if (!form.price || !form.phone || !form.location) return false;
    }
    return true;
  };

  const next = () => validate() && setStep((s) => s + 1);

  // ------------------------------------------------------------
  // SUBMIT (Express backend)
  // ------------------------------------------------------------
  const submit = async () => {
    if (!validate() || !dealer) return;
    setLoading(true);

    try {
      // Upload new images
      const uploaded: string[] = [];
      for (const file of galleryFiles) {
        const url = await uploadCloudinary(file, () => {}, "image");
        uploaded.push(url);
      }

      let videoUrl = listing?.video_url ?? null;
      if (videoFile) {
        videoUrl = await uploadCloudinary(videoFile, () => {}, "video");
      }

      const payload = {
        dealer_id: dealer.id,
        make: form.make,
        model: form.model,
        year: Number(form.year),
        mileage: Number(form.mileage),
        condition: form.condition,
        price: Number(form.price),
        description: form.description,
        phone: form.phone,
        location: form.location,
        gallery: [...existing, ...uploaded].slice(0, MAX_GALLERY),
        video_url: videoUrl,
      };

      if (listing) {
        // UPDATE
        await fetch(`/api/admin/cars/${listing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Updated", description: "Listing updated." });
      } else {
        // CREATE
        await fetch(`/api/admin/cars`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Created", description: "Listing submitted." });
      }

      onSubmitComplete();
      onClose();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", variant: "destructive" });
    }

    setLoading(false);
  };

  // UI
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {listing ? "Edit Listing" : "Create Listing"}
          </DialogTitle>
          <DialogDescription>
            Step {step} of 3 — Fill all fields
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Make</Label>
                <Input
                  value={form.make}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, make: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label>Model</Label>
                <Input
                  value={form.model}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, model: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Year</Label>
                <Input
                  value={form.year}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, year: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label>Mileage</Label>
                <Input
                  value={form.mileage}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, mileage: e.target.value }))
                  }
                />
              </div>
            </div>

            <Button className="w-full" onClick={next}>
              Next
            </Button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-3">
            <Label>Upload Images</Label>
            <Input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) =>
                setGalleryFiles(Array.from(e.target.files ?? []))
              }
            />

            <Label>Description</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={next}>Next</Button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="space-y-3">
            <Label>Price</Label>
            <Input
              value={form.price}
              onChange={(e) =>
                setForm((f) => ({ ...f, price: e.target.value }))
              }
            />

            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />

            <Label>Location</Label>
            <Input
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
            />

            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>

              <Button disabled={loading} onClick={submit}>
                {loading ? "Saving..." : listing ? "Update" : "Submit"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==========================================================================
// MAIN DASHBOARD
// ==========================================================================
export default function DealerDashboard() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);

  // Redirect if not dealer
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "dealer")) {
      navigate("/login");
    }
  }, [isLoading, user]);

  // LOAD DATA (Dealer from Supabase, Cars from Express backend)
  const loadData = useCallback(async () => {
    if (!user) return;

    // Dealer still on Supabase
    const { data: d } = await supabase
      .from("dealers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    setDealer(d ?? null);

    if (d) {
      const res = await fetch("/api/admin/cars");
      const cars = await res.json();
      setListings(cars.filter((c: any) => c.dealer_id === d.id));
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [openCreate, setOpenCreate] = useState(false);
  const [editListing, setEditListing] = useState<Listing | null>(null);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Car size={22} />
          Dealer Dashboard
        </h1>

        <Button onClick={() => setOpenCreate(true)}>
          <Plus size={16} className="mr-2" /> New Listing
        </Button>
      </div>

      {/* LISTINGS */}
      <div className="grid md:grid-cols-2 gap-4">
        {listings.map((l) => (
          <Card key={l.id} className="p-4">
            <div className="flex justify-between">
              <div>
                <h2 className="font-bold text-lg">
                  {l.make} {l.model}
                </h2>
                <p className="text-gray-600 text-sm">{l.year}</p>
                <Badge className="mt-2">{l.status}</Badge>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setEditListing(l)}
              >
                <Edit size={16} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* CREATE WIZARD */}
      <ListingWizard
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        dealer={dealer}
        listing={null}
        onSubmitComplete={() => loadData()}
      />

      {/* EDIT WIZARD */}
      <ListingWizard
        open={!!editListing}
        onClose={() => setEditListing(null)}
        dealer={dealer}
        listing={editListing}
        onSubmitComplete={() => loadData()}
      />
    </div>
  );
}
