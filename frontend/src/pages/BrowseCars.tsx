import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CarCardMedia from "@/components/CarCardMedia";
import ShareActions from "@/components/ShareActions";
import { Input } from "@/components/ui/input";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { buildWhatsappUrl } from "@/lib/utils";
import { carSlug } from "@/utils/carSlug";

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
  video_url: string | null;
}

const PAGE_SIZE = 12;

const BrowseCars = () => {
  const [search, setSearch] = useState("");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<
    { cars: Car[]; nextOffset?: number },
    Error
  >({
    queryKey: ["cars", search],
    queryFn: async ({ pageParam = 0 }: any) => {
      const pageNumber = typeof pageParam === "number" ? pageParam : 0;

      let query = supabase
        .from("cars")
        .select("*")
        .eq("status", "active")
        .order("id", { ascending: false })
        .range(pageNumber, pageNumber + PAGE_SIZE - 1);

      const trimmed = search.trim();
      if (trimmed) {
        query = query.or(
          `make.ilike.%${trimmed}%,model.ilike.%${trimmed}%,location.ilike.%${trimmed}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return {
        cars: (data ?? []) as Car[],
        nextOffset:
          data && data.length === PAGE_SIZE ? pageNumber + PAGE_SIZE : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
  });

  const cars = data?.pages.flatMap((page) => page.cars) ?? [];

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage]);

  // 🧩 Lightbox State
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const openLightbox = (images: string[], index = 0) => {
    setLightboxImages(images);
    setCurrentImage(index);
    setIsLightboxOpen(true);
    document.body.style.overflow = "hidden";
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
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Browse Cars</h1>
              <p className="text-gray-600">
                Found {cars.length} vehicles
              </p>
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cars by make, model, or location"
              className="max-w-md"
            />
          </div>

          {isLoading ? (
            <div className="text-center text-gray-500">Loading cars...</div>
          ) : cars.length ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {cars.map((car) => {
                const images =
                  car.gallery && car.gallery.length > 0
                    ? car.gallery
                    : car.image
                    ? [car.image]
                    : ["/placeholder-car.jpg"];
                return (
                  <Card
                    key={car.id}
                    className="group hover:shadow-lg transition-all duration-300 overflow-hidden"
                  >
                    <div
                      className="relative w-full h-36 sm:h-52 overflow-hidden cursor-pointer"
                      onClick={() => openLightbox(images)}
                    >
                      <CarCardMedia
                        images={images}
                        videoUrl={car.video_url}
                        alt={`${car.make} ${car.model}`}
                        className="h-full"
                      />
                      {car.featured && (
                        <span className="absolute top-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded">
                          Featured
                        </span>
                      )}
                    </div>

                    <CardContent className="p-2 sm:p-4">
                      <h3 className="font-semibold text-sm sm:text-lg text-gray-800 truncate">
                        {car.make} {car.model} ({car.year})
                      </h3>
                      <p className="text-blue-600 font-bold text-sm sm:text-base mt-1 truncate">
                        {formatPrice(Number(car.price))}
                      </p>
                      <p className="text-[11px] sm:text-sm text-gray-500 mt-1 truncate">
                        {car.mileage.toLocaleString()} km •{" "}
                        {car.transmission || "N/A"}
                      </p>

                      <div className="flex gap-1 sm:gap-2 mt-2 sm:mt-4">
                        <Link to={`/cars/${carSlug(car)}`} className="flex-1">
                          <button className="w-full py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-800 text-white rounded hover:bg-gray-900 transition">
                            View Details
                          </button>
                        </Link>
                        <a
                          href={buildWhatsappUrl(car.phone, `Hi! I'm interested in your ${car.make} ${car.model}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-sm border rounded hover:bg-gray-100"
                        >
                          WhatsApp
                        </a>
                      </div>
                      <ShareActions
                        compact
                        url={`/cars/${carSlug(car)}`}
                        carId={car.id}
                        title={`${car.year} ${car.make} ${car.model}`}
                        description={`Check out this ${car.year} ${car.make} ${car.model} for ${formatPrice(Number(car.price))} in ${car.location}.`}
                        imageUrl={images[0]}
                      />
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
          {isFetchingNextPage && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Loading more cars...
            </div>
          )}
          <div ref={loadMoreRef} className="h-1" />
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
