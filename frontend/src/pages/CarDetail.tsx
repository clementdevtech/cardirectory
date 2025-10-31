import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Phone, Mail, MapPin } from "lucide-react";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
  }).format(price);

type Car = {
  id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  description?: string;
  condition?: string;
  gallery?: string[];
  image?: string;
  phone?: string;
  transmission?: string;
  location?: string;
  dealer_id?: string;
};

type Dealer = {
  id: string;
  full_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  country?: string;
  company_logo?: string;
};

const CarDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // 🧩 Fetch Car Info
  const {
    data: car,
    isLoading,
    error,
  } = useQuery<Car>({
    queryKey: ["car", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw new Error(error.message);
      return data as Car;
    },
    enabled: !!id,
  });

  // 🧩 Fetch Dealer Info if car found
  const { data: dealer } = useQuery<Dealer | null>({
    queryKey: ["dealer", car?.dealer_id],
    queryFn: async () => {
      if (!car?.dealer_id) return null;
      const { data, error } = await supabase
        .from("dealers")
        .select("id, full_name, company_name, email, phone, country, company_logo")
        .eq("id", car.dealer_id)
        .single();
      if (error) throw new Error(error.message);
      return data as Dealer;
    },
    enabled: !!car?.dealer_id,
  });

  if (isLoading)
    return <div className="container px-4 py-8">Loading car details...</div>;

  if (error)
    return (
      <div className="container px-4 py-8 text-red-600">
        Error loading car details.
      </div>
    );

  if (!car) return <div className="container px-4 py-8">Car not found.</div>;

  const mainImage = selectedImage || car.gallery?.[0] || car.image || "";
  const whatsappUrl = `https://wa.me/${car.phone?.replace(
    /^0/,
    "254"
  )}?text=${encodeURIComponent(
    `Hi, I'm interested in the ${car.year} ${car.make} ${car.model} listed on Auto Kenya.`
  )}`;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* 🖼️ Car Gallery Section */}
            <div className="lg:col-span-2">
              <div className="w-full h-[400px] bg-gray-200 rounded-lg overflow-hidden">
                <img
                  src={mainImage}
                  alt={`${car.make} ${car.model}`}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Thumbnails */}
              {car.gallery && car.gallery.length > 1 && (
                <div className="flex gap-3 mt-4 overflow-x-auto">
                  {car.gallery.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`Gallery ${i + 1}`}
                      onClick={() => setSelectedImage(img)}
                      className={`w-24 h-24 rounded-md object-cover cursor-pointer border-2 ${
                        selectedImage === img
                          ? "border-blue-600"
                          : "border-transparent"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Description */}
              <h1 className="text-3xl font-bold mt-6">
                {car.year} {car.make} {car.model}
              </h1>
              <p className="text-2xl font-semibold text-blue-700 mt-2">
                {formatPrice(Number(car.price))}
              </p>
              <p className="mt-4 text-gray-700">{car.description}</p>

              <div className="mt-4 text-sm text-gray-600">
                <p>
                  <strong>Condition:</strong> {car.condition || "N/A"}
                </p>
                <p>
                  <strong>Transmission:</strong> {car.transmission || "N/A"}
                </p>
                <p>
                  <strong>Location:</strong> {car.location || "N/A"}
                </p>
              </div>
            </div>

            {/* 📞 Sidebar Dealer Info */}
            <aside className="space-y-6">
              {/* Dealer Information */}
              {dealer && (
                <div className="p-5 border rounded-lg bg-white shadow-sm">
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-3">
                    {/* 🧾 Dealer Logo */}
                    {dealer.company_logo ? (
                      <img
                        src={dealer.company_logo}
                        alt={`${dealer.full_name} logo`}
                        className="w-10 h-10 object-cover rounded-full border"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-500">
                        No Logo
                      </div>
                    )}
                    <span>{dealer.full_name}</span>
                  </h3>

                  {dealer.company_name && (
                    <p className="text-sm text-gray-600 mb-1">
                      {dealer.company_name}
                    </p>
                  )}

                  {dealer.country && (
                    <p className="text-sm text-gray-600 flex items-center mb-1">
                      <MapPin className="w-4 h-4 mr-1" /> {dealer.country}
                    </p>
                  )}

                  <div className="flex flex-col gap-2 mt-4">
                    {dealer.phone && (
                      <>
                        <a
                          href={`https://wa.me/${dealer.phone.replace(/\s/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
                        >
                          WhatsApp Dealer
                        </a>
                        <a
                          href={`tel:${dealer.phone}`}
                          className="flex items-center justify-center gap-2 border py-2 rounded hover:bg-blue-50 transition"
                        >
                          <Phone className="w-4 h-4" /> Call Dealer
                        </a>
                      </>
                    )}
                    {dealer.email && (
                      <a
                        href={`mailto:${dealer.email}`}
                        className="flex items-center justify-center gap-2 border py-2 rounded hover:bg-gray-50 transition"
                      >
                        <Mail className="w-4 h-4" /> Email Dealer
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* WhatsApp Contact for Car */}
              <div className="p-5 border rounded-lg bg-white shadow-sm">
                <h3 className="font-semibold text-lg mb-2">Contact Seller</h3>
                <p className="text-gray-700 mb-3">
                  Interested in this car? Contact the seller directly on WhatsApp.
                </p>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-green-600 text-white text-center py-3 rounded-lg hover:bg-green-700 transition"
                >
                  Message on WhatsApp
                </a>
              </div>

              <Link
                to="/cars"
                className="block text-center bg-gray-800 text-white py-3 rounded-lg hover:bg-gray-900 transition"
              >
                ← Back to Browse
              </Link>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CarDetail;
