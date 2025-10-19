import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
  }).format(price);

interface Car {
  id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  location: string;
  gallery: string[];
  image: string | null;
  featured: boolean;
  transmission: string | null;
  phone: string | null;
}

const BrowseCars = () => {
  const { data: cars, isLoading, error } = useQuery({
    queryKey: ["cars"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("status", "active")
        .order("id", { ascending: false });
      if (error) throw error;
      return data as Car[];
    },
  });

  // 🧩 Lightbox State
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const openLightbox = (images: string[], index = 0) => {
    setLightboxImages(images);
    setCurrentImage(index);
    setIsLightboxOpen(true);
    document.body.style.overflow = "hidden"; // prevent background scroll
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    document.body.style.overflow = "auto";
  };

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % lightboxImages.length);
  };

  const prevImage = () => {
    setCurrentImage((prev) =>
      prev === 0 ? lightboxImages.length - 1 : prev - 1
    );
  };

  if (error) {
    return (
      <div className="text-center text-red-500 mt-10">
        Error loading cars: {error.message}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold">Browse Cars</h1>
            <p className="text-gray-600">
              Found {cars?.length ?? "0"} vehicles
            </p>
          </div>

          {isLoading ? (
            <div className="text-center text-gray-500">Loading cars...</div>
          ) : cars?.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cars.map((car) => {
                const images =
                  car.gallery && car.gallery.length > 0
                    ? car.gallery
                    : car.image
                    ? [car.image]
                    : ["/placeholder-car.jpg"];
                const mainImage = images[0];

                return (
                  <Card
                    key={car.id}
                    className="group hover:shadow-lg transition-all duration-300 overflow-hidden"
                  >
                    <div
                      className="relative w-full h-52 overflow-hidden cursor-pointer"
                      onClick={() => openLightbox(images)}
                    >
                      <img
                        src={mainImage}
                        alt={`${car.make} ${car.model}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) =>
                          ((e.target as HTMLImageElement).src =
                            "/placeholder-car.jpg")
                        }
                      />
                      {car.featured && (
                        <span className="absolute top-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded">
                          Featured
                        </span>
                      )}
                    </div>

                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg text-gray-800">
                        {car.make} {car.model} ({car.year})
                      </h3>
                      <p className="text-blue-600 font-bold mt-1">
                        {formatPrice(Number(car.price))}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {car.mileage.toLocaleString()} km •{" "}
                        {car.transmission || "N/A"}
                      </p>

                      <div className="flex gap-2 mt-4">
                        <Link to={`/cars/${car.id}`} className="flex-1">
                          <button className="w-full py-2 bg-gray-800 text-white rounded hover:bg-gray-900 transition">
                            View Details
                          </button>
                        </Link>
                        <a
                          href={`https://wa.me/${car.phone?.replace(
                            /[^0-9]/g,
                            ""
                          )}?text=Hi! I'm interested in your ${car.make} ${car.model}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 border rounded hover:bg-gray-100"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500">
              No cars available yet.
            </div>
          )}
        </div>
      </main>

      {/* 🖼️ Lightbox Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <button
            onClick={closeLightbox}
            className="absolute top-5 right-5 text-white hover:text-gray-300 transition"
          >
            <X className="h-8 w-8" />
          </button>

          {lightboxImages.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-6 text-white hover:text-gray-300"
              >
                <ChevronLeft className="h-10 w-10" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-6 text-white hover:text-gray-300"
              >
                <ChevronRight className="h-10 w-10" />
              </button>
            </>
          )}

          <img
            src={lightboxImages[currentImage]}
            alt="Car"
            className="max-w-[90%] max-h-[80%] rounded-lg object-contain shadow-lg transition-all"
          />
          <div className="absolute bottom-6 text-white text-sm">
            {currentImage + 1} / {lightboxImages.length}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default BrowseCars;
