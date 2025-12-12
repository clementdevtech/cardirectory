// src/hooks/useCarForm.ts
import { useState } from "react";

export type CarFormShape = {
  id?: number | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  condition?: string;
  transmission?: string;
  price: number;
  location?: string;
  phone?: string;
  description?: string;
  featured?: boolean;
  gallery?: string[];
  video_url?: string;
  dealer_id?: string | null;
  status?: string;
};

export const useCarForm = (initial?: Partial<CarFormShape>) => {
  const empty: CarFormShape = {
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
    ...initial,
  };

  const [form, setForm] = useState<Partial<CarFormShape>>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  const startEdit = (car: Partial<CarFormShape> & { id: number }) => {
    setEditId(car.id);
    setForm({
      ...car,
      price: Number(car.price) || 0,
      mileage: Number(car.mileage) || 0,
      year: Number(car.year) || 0,
      gallery: car.gallery || [],
    });
  };

  const resetForm = () => {
    setEditId(null);
    setForm(empty);
  };

  return { form, setForm, editId, startEdit, resetForm };
};
