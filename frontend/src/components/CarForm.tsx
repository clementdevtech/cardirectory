import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, Star } from "lucide-react";

type Props = {
  form: any;
  setForm: any;
  loading: boolean;
  editMode: boolean;

  galleryPreview: string[];
  setGalleryFiles: (files: File[]) => void;

  galleryProgress: any[];
  locationQuery: string;
  setLocationQuery: (v: string) => void;
  suggestions: any[];
  onSelectSuggestion: (place: any) => void;
  dealerOptions?: Array<{ id: string; full_name: string; company_name?: string; email?: string }>;
  selectedDealerId?: string | null;
  onDealerChange?: (dealerId: string | null) => void;

  onSubmit: (e: React.FormEvent) => void;
  onCancelEdit: () => void;
};

const CarForm: React.FC<Props> = ({
  form,
  setForm,
  loading,
  editMode,
  galleryPreview,
  setGalleryFiles,
  galleryProgress,
  locationQuery,
  setLocationQuery,
  suggestions,
  onSelectSuggestion,
  dealerOptions = [],
  selectedDealerId,
  onDealerChange,
  onSubmit,
  onCancelEdit,
}) => {
  const [locationSelected, setLocationSelected] = useState(Boolean(form.location));

  useEffect(() => {
    if (!form.location) setLocationSelected(false);
  }, [form.location]);

  const handleLocationChange = (value: string) => {
    setLocationSelected((selected) => selected || Boolean(form.location));
    setLocationQuery(value);
    setForm({ ...form, location: value });
  };

  const handleSuggestionSelect = (place: any) => {
    setLocationSelected(true);
    setForm({ ...form, location: place.formatted });
    setLocationQuery(place.formatted);
    onSelectSuggestion(place);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">

      {/* Make & Model */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Make</Label>
          <Input
            value={form.make || ""}
            onChange={(e) => setForm({ ...form, make: e.target.value })}
          />
        </div>

        <div>
          <Label>Model</Label>
          <Input
            value={form.model || ""}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
          />
        </div>

        <div>
          <Label>Year</Label>
          <Input
            type="number"
            value={form.year ?? ""}
            onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
          />
        </div>

        <div>
          <Label>Mileage</Label>
          <Input
            type="number"
            value={form.mileage ?? ""}
            onChange={(e) =>
              setForm({ ...form, mileage: Number(e.target.value) })
            }
          />
        </div>
      </div>

      {/* Gallery */}
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
            onChange={(e) => {
              const files = Array.from(e.target.files || []).slice(0, 8);
              setGalleryFiles(files);
            }}
          />

          <div className="grid grid-cols-4 gap-3 mt-4">
            {galleryPreview.map((img, i) => (
              <img
                key={i}
                src={img}
                className="w-full h-24 object-cover rounded border"
              />
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {galleryProgress.map((p) => (
              <div key={p.fileName} className="text-sm">
                {p.fileName} — {p.progress}%
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dealer assignment */}
      {dealerOptions.length > 0 && (
        <div>
          <Label>Assign Dealer</Label>
          <select
            value={selectedDealerId ?? form.dealer_id ?? ""}
            onChange={(e) => {
              const value = e.target.value || null;
              setForm({ ...form, dealer_id: value });
              onDealerChange?.(value);
            }}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2"
          >
            <option value="">Select a dealer</option>
            {dealerOptions.map((dealer) => (
              <option key={dealer.id} value={dealer.id}>
                {dealer.full_name} {dealer.company_name ? `• ${dealer.company_name}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Price */}
      <Label>Price</Label>
      <Input
        type="number"
        value={form.price ?? ""}
        onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
      />

      {/* Location Search */}
      <Label>Location</Label>
      <Input
        value={locationQuery || form.location || ""}
        onChange={(e) => handleLocationChange(e.target.value)}
        placeholder="Enter or search location..."
      />

      {!locationSelected && suggestions.map((s) => (
        <div
          key={s.place_id}
          className="p-2 border cursor-pointer hover:bg-gray-100"
          onClick={() => handleSuggestionSelect(s)}
        >
          {s.formatted}
        </div>
      ))}

      {/* Phone */}
      <Label>Phone</Label>
      <Input
        value={form.phone ?? ""}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />

      {/* Description */}
      <Label>Description</Label>
      <Textarea
        value={form.description ?? ""}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />

      {/* Featured */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!form.featured}
          onChange={(e) =>
            setForm({ ...form, featured: e.target.checked })
          }
        />
        <Label className="flex items-center gap-1">
          <Star className="text-yellow-500 w-4 h-4" /> Feature this car
        </Label>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : editMode ? "Update Car" : "Add Car"}
        </Button>

        {editMode && (
          <Button type="button" variant="ghost" onClick={onCancelEdit}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};

export default CarForm;
