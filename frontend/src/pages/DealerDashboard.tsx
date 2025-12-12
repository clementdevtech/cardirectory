// ==========================================================================
// DealerDashboard (Rewritten to use CarForm + Hooks)
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

import { Car, Plus, Edit } from "lucide-react";

// ================== IMPORTS FOR NEW FORM SYSTEM ===================
import CarForm from "@/components/CarForm";
import { useCarForm } from "@/hooks/useCarForm";
import { useCarUploads } from "@/hooks/useCarUploads";
import { useLocationSearch } from "@/hooks/useLocationSearch";

// ==================================================================
// TYPES
// ==================================================================
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

// ==================================================================
// MAIN DASHBOARD
// ==================================================================
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

    // Dealer still from Supabase
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

  // ==================================================================
  // CAR FORM HOOKS (shared with Admin Dashboard)
  // ==================================================================
  const {
    form,
    setForm,
    editId,
    startEdit,
    resetForm,
  } = useCarForm();

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
  } = useLocationSearch(import.meta.env.VITE_GEOAPIFY_API_KEY);

  // ==================================================================
  // MODAL CONTROL
  // ==================================================================
  const [openModal, setOpenModal] = useState(false);

  const openCreateModal = () => {
    resetForm();
    resetUploads();
    setOpenModal(true);
  };

  const openEditModal = (listing: Listing) => {
    startEdit(listing);
    resetUploads();
    setOpenModal(true);
  };

  // ==================================================================
  // SUBMIT HANDLER
  // ==================================================================
  const handleDealerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealer) {
      toast({ title: "Error", description: "Dealer info missing", variant: "destructive" });
      return;
    }

    try {
      const { galleryUrls, videoUrl } = await uploadAssets();

      const payload = {
        ...form,
        dealer_id: dealer.id,
        price: Number(form.price),
        year: Number(form.year),
        mileage: Number(form.mileage),
        gallery: [...(form.gallery || []), ...galleryUrls],
        video_url: videoUrl || "",
      };

      if (editId) {
        // Update
        await fetch(`/api/admin/cars/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        toast({ title: "Updated", description: "Listing updated successfully" });
      } else {
        // Create
        await fetch(`/api/admin/cars`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        toast({ title: "Created", description: "Listing submitted for approval" });
      }

      resetForm();
      resetUploads();
      setOpenModal(false);
      loadData();
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // ==================================================================
  // UI
  // ==================================================================
  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Car size={22} />
          Dealer Dashboard
        </h1>

        <Button onClick={openCreateModal}>
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
                onClick={() => openEditModal(l)}
              >
                <Edit size={16} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* MAIN CAR FORM MODAL */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Edit Listing" : "Create New Listing"}
            </DialogTitle>
            <DialogDescription>
              Fill all the required details for your car listing.
            </DialogDescription>
          </DialogHeader>

          <CarForm
            form={form}
            setForm={setForm}
            loading={false}
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
            onSubmit={handleDealerSubmit}
            onCancelEdit={() => {
              resetForm();
              resetUploads();
              setOpenModal(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
