import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon } from "lucide-react";

type DealerShape = {
  full_name: string;
  email: string;
  company_name?: string;
  phone?: string;
  country: string;
  logo?: string | null;
};

type Props = {
  onCreate: (payload: DealerShape) => Promise<void>;
  disabled?: boolean;
};

const DealerForm: React.FC<Props> = ({ onCreate, disabled }) => {
  const [form, setForm] = useState<DealerShape>({
    full_name: "",
    email: "",
    company_name: "",
    phone: "",
    country: "",
    logo: null,
  });

  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogoSelect = (file: File | null) => {
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.country) {
      alert("Please fill full name, email and country");
      return;
    }
    setLoading(true);
    try {
      await onCreate({
        ...form,
        logo: logoBase64 || null,
      });
      setForm({ full_name: "", email: "", company_name: "", phone: "", country: "", logo: null });
      setLogoBase64(null);
      setLogoPreview(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Full Name</Label>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>

        <div>
          <Label>Email</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>

        <div>
          <Label>Company Name</Label>
          <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
        </div>

        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>

        <div>
          <Label>Country</Label>
          <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>Upload Dealer Logo</Label>
        <div
          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer"
          onClick={() => document.getElementById("dealer-logo-input")?.click()}
        >
          {logoPreview ? (
            <img src={logoPreview} className="w-32 h-32 mx-auto object-cover rounded" />
          ) : (
            <div className="text-gray-400 flex flex-col items-center">
              <ImageIcon className="w-10 h-10" />
              <p>Click to upload logo</p>
            </div>
          )}

          <input
            id="dealer-logo-input"
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleLogoSelect(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      <div>
        <Button type="submit" disabled={loading || disabled}>
          {loading ? "Saving..." : "Add Dealer"}
        </Button>
      </div>
    </form>
  );
};

export default DealerForm;
