import React, { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import CarCardMedia from "@/components/CarCardMedia";
import ShareActions from "@/components/ShareActions";
import { Input } from "@/components/ui/input";
import { buildWhatsappUrl } from "@/lib/utils";
import { carSlug } from "@/utils/carSlug";

// ✅ Matches your actual cars table
interface Car {
  id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  location: string;
  phone: string | null;
  image: string | null;
  gallery: string[] | null;
  video_url: string | null;
  description: string | null;
  condition: string | null;
  transmission: string | null;
  featured: boolean;
  status: string;
  created_at: string;
}

// ✅ Currency format for Kenya
const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(price);

const PAGE_SIZE = 8;

const FeaturedCars: React.FC = () => {
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
    queryKey: ["featured-cars", search],
    queryFn: async ({ pageParam = 0 }: any) => {
      const pageNumber = typeof pageParam === "number" ? pageParam : 0;

      let query = supabase
        .from("cars")
        .select("*")
        .eq("featured", true)
        .eq("status", "active")
        .order("created_at", { ascending: false })
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
        cars: data ?? [],
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

  if (isLoading)
    return (
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">Loading cars...</div>
      </section>
    );

  if (error)
    return (
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center text-red-500">
          Failed to load cars: {error.message}
        </div>
      </section>
    );

  if (!cars.length)
    return (
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-semibold mb-2">Featured Cars</h2>
          <p className="text-muted-foreground">No featured cars match your search.</p>
        </div>
      </section>
    );

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold">Featured Cars</h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              Search and browse featured vehicles with infinite scrolling.
            </p>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search featured cars..."
            className="max-w-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {cars.map((car) => (
            <Card
              key={car.id}
              className="overflow-hidden group hover:shadow-lg transition-shadow"
            >
              {/* 🖼️ Main Image */}
              <div className="relative overflow-hidden">
                <CarCardMedia
                  images={car.image ? [car.image, ...(car.gallery ?? [])] : car.gallery ?? []}
                  videoUrl={car.video_url}
                  alt={`${car.make} ${car.model}`}
                  className="h-36 sm:h-44 lg:h-48 group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                {/* Vehicle Info */}
                <div>
                  <h3 className="font-heading font-semibold text-sm sm:text-base lg:text-lg capitalize leading-tight">
                    {car.year} {car.make} {car.model}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-tight">
                    {car.transmission ? `${car.transmission} • ` : ""}
                    {car.condition ?? "Condition unknown"}
                  </p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-primary mt-1 leading-tight">
                    {formatPrice(Number(car.price))}
                  </p>
                </div>

                {/* 🏞️ Small gallery thumbnails */}
                {car.gallery && car.gallery.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pt-1 sm:pt-2">
                    {car.gallery.slice(1, 4).map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt="Gallery thumbnail"
                        className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 object-cover rounded-md shrink-0"
                      />
                    ))}
                  </div>
                )}

                {/* 🎥 Optional video preview */}

                {/* 📞 Action Buttons */}
                <div className="flex gap-2 pt-2 sm:pt-3">
                  <Link to={`/cars/${carSlug(car)}`} className="flex-1">
                    <Button variant="default" className="w-full h-9 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm">
                      View Details
                    </Button>
                  </Link>
                  {car.phone && (
                    <a
                      href={buildWhatsappUrl(
                        car.phone,
                        `Hi, I'm interested in your ${car.year} ${car.make} ${car.model} listed on AutoKenya.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button
                        variant="secondary"
                        className="w-full h-9 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white"
                      >
                        WhatsApp
                      </Button>
                    </a>
                  )}
                </div>
                <ShareActions
                  compact
                  url={`/cars/${carSlug(car)}`}
                  carId={car.id}
                  title={`${car.year} ${car.make} ${car.model}`}
                  description={`Check out this ${car.year} ${car.make} ${car.model} for ${formatPrice(
                    Number(car.price)
                  )} in ${car.location}.`}
                  imageUrl={car.image ?? car.gallery?.[0] ?? "/placeholder-car.jpg"}
                />
              </CardContent>
            </Card>
          ))}
        </div>
        {isFetchingNextPage && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            Loading more featured cars...
          </div>
        )}
        <div ref={loadMoreRef} className="h-1" />
      </div>
    </section>
  );
};

export default FeaturedCars;
