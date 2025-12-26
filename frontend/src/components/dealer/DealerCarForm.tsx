import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import CarMediaUploader from "@/components/CarMediaUploader";
import { useCarDraft } from "@/hooks/useCarDraft";
import { clearCarDraft, loadCarDraft } from "@/utils/carDraft";
const API_BASE = (import.meta.env.VITE_BACKEND_URL as string);

const CONDITIONS = ["new", "used", "imported", "good"];
const TRANSMISSIONS = ["manual", "automatic"];

interface Props {
  step: number;
  setStep: (n: number) => void;
  form: any;
  setForm: (v: any) => void;
  errors: Record<string, string>;
  isEdit?: boolean;
}

const DealerCarForm: React.FC<Props> = ({
  step,
  setStep,
  form,
  setForm,
  errors,
  isEdit,
}) => {
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const update = (k: string, v: any) =>
    setForm((p: any) => ({ ...p, [k]: v }));

  // Load draft if available
  useEffect(() => {
    if (!user || isEdit) return;
    const draft = loadCarDraft(user.id);
    if (draft) setForm(draft);
  }, [user, isEdit, setForm]);

  useCarDraft(user?.id, form);

  const canProceedStep1 =
    form.make && form.model && form.year && form.mileage && form.condition;
  const canProceedStep2 =
    form.description && form.gallery?.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setSubmitError("User not authenticated");
      return;
    }

    setLoading(true);
    setSubmitError("");

    try {
      const { data, error } = await fetch(`${API_BASE}/cars`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          ...form,
          dealer_id: user.id,
          status: "pending",
        }),
      }).then((res) => res.json());

      if (error) throw new Error(error.message || "Failed to submit car");

      clearCarDraft(user.id);
      alert("Car submitted successfully!");
      setForm({});
      setStep(1);
    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || "Failed to submit car");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>Please login to post a car.</div>;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-h-[80vh] overflow-auto p-4"
    >
      {/* STEP INDICATOR */}
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3].map((s) => (
          <Badge key={s} variant={step === s ? "default" : "outline"}>
            Step {s}
          </Badge>
        ))}
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Make</Label>
              <Input
                value={form.make || ""}
                onChange={(e) => update("make", e.target.value)}
              />
            </div>
            <div>
              <Label>Model</Label>
              <Input
                value={form.model || ""}
                onChange={(e) => update("model", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Year</Label>
              <Input
                type="number"
                value={form.year || ""}
                onChange={(e) => update("year", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Mileage (km)</Label>
              <Input
                type="number"
                value={form.mileage || ""}
                onChange={(e) => update("mileage", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Condition</Label>
              <select
                className="w-full border rounded px-3 py-2"
                value={form.condition || CONDITIONS[0]}
                onChange={(e) => update("condition", e.target.value)}
              >
                {CONDITIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>Transmission</Label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.transmission || ""}
              onChange={(e) => update("transmission", e.target.value)}
            >
              <option value="">Select</option>
              {TRANSMISSIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <Label>Description</Label>
            <Textarea
              rows={5}
              value={form.description || ""}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>

          <CarMediaUploader
            onUploadComplete={({ gallery, video_url }) =>
              setForm((p: any) => ({ ...p, gallery, video_url }))
            }
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {form.gallery?.map((img: string, i: number) => (
              <div key={img} className="relative">
                <img
                  src={img}
                  className="w-full h-24 sm:h-28 md:h-32 object-cover rounded"
                />
                <X
                  className="absolute top-1 right-1 bg-white rounded cursor-pointer"
                  onClick={() =>
                    update(
                      "gallery",
                      form.gallery.filter((_: any, x: number) => x !== i)
                    )
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <Label>Price (KES)</Label>
            <Input
              type="number"
              value={form.price || ""}
              onChange={(e) => update("price", Number(e.target.value))}
            />
          </div>

          <div>
            <Label>Location</Label>
            <Input
              value={form.location || ""}
              onChange={(e) => update("location", e.target.value)}
            />
          </div>

          <div>
            <Label>Contact Phone</Label>
            <Input
              value={form.phone || ""}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
        </div>
      )}

      {submitError && <p className="text-red-500">{submitError}</p>}

      {/* NAVIGATION */}
      <div className="flex justify-between pt-6 flex-wrap gap-2">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
        )}

        {step < 3 ? (
          <Button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={
              (step === 1 && !canProceedStep1) ||
              (step === 2 && !canProceedStep2)
            }
          >
            Next
          </Button>
        ) : (
          <Button type="submit" disabled={loading} className="ml-auto">
            {loading ? "Submitting..." : "Submit Listing"}
          </Button>
        )}
      </div>
    </form>
  );
};

export default DealerCarForm;
