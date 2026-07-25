import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

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

const FeaturedCars: React.FC = () => {
  // Fetch only active + featured cars
  const { data: cars, isLoading, error } = useQuery<Car[], Error>({
    queryKey: ["featured-cars"],
    queryFn: async (): Promise<Car[]> => {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("featured", true)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      return data ?? [];
    },
  });

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

  if (!cars?.length)
    return (
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-semibold mb-2">Featured Cars</h2>
          <p className="text-muted-foreground">No featured cars available right now.</p>
        </div>
      </section>
    );

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-10 text-center">
          Featured Cars
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {cars.map((car) => (
            <Card
              key={car.id}
              className="overflow-hidden group hover:shadow-lg transition-shadow"
            >
              {/* 🖼️ Main Image */}
              <div className="relative overflow-hidden">
                <img
                  src={
                    car.image ??
                    car.gallery?.[0] ??
                    "/placeholder.jpg"
                  }
                  alt={`${car.make} ${car.model}`}
                  className="w-full h-36 sm:h-44 lg:h-48 object-cover group-hover:scale-110 transition-transform duration-300"
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
                {car.video_url && (
                  <video
                    src={car.video_url}
                    controls
                    className="w-full rounded-md mt-3"
                    style={{ maxHeight: "160px" }}
                  />
                )}

                {/* 📞 Action Buttons */}
                <div className="flex gap-2 pt-2 sm:pt-3">
                  <Link to={`/cars/${car.id}`} className="flex-1">
                    <Button variant="default" className="w-full h-9 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm">
                      View Details
                    </Button>
                  </Link>
                  {car.phone && (
                    <a
                      href={`https://wa.me/${car.phone.replace(
                        /^0/,
                        "+254"
                      )}?text=${encodeURIComponent(
                        `Hi, I'm interested in your ${car.year} ${car.make} ${car.model} listed on AutoKenya.`
                      )}`}
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
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedCars;
