import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowLeft, CheckCircle, Mail, MapPin, Phone } from "lucide-react";
import ShareActions from "@/components/ShareActions";
import { dealerCompanySlug } from "@/utils/dealerSlug";
import { carSlug } from "@/utils/carSlug";
import { buildWhatsappUrl } from "@/lib/utils";

interface Dealer {
  id: string;
  full_name: string;
  company_name?: string;
  email: string;
  phone?: string;
  country?: string;
  status: string;
  created_at: string;
  company_logo?: string;
}

interface Car {
  id: number;
  dealer_id: string;
  gallery?: string[];
  make: string;
  model: string;
  price: number;
  status?: string;
  created_at?: string;
  year?: number;
  location?: string;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
  }).format(price);

const DealerProfile: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const {
    data: dealer,
    isLoading: dealerLoading,
    error: dealerError,
  } = useQuery<Dealer | null>({
    queryKey: ["dealer-profile", slug],
    queryFn: async () => {
      if (!slug) return null;

      const { data, error } = await supabase
        .from("dealers")
        .select(
          "id, full_name, company_name, email, phone, country, status, created_at, company_logo"
        )
        .order("created_at", { ascending: true });

      if (error) throw new Error(error.message);

      const matchedDealer = (data || []).find(
        (item) => dealerCompanySlug(item as Dealer) === slug
      ) as Dealer | undefined;

      return matchedDealer || null;
    },
    enabled: !!slug,
  });

  const { data: cars = [], isLoading: carsLoading } = useQuery<Car[]>({
    queryKey: ["dealer-cars", dealer?.id],
    queryFn: async () => {
      if (!dealer?.id) return [];

      const { data, error } = await supabase
        .from("cars")
        .select("id, dealer_id, gallery, make, model, price, status, created_at, year, location")
        .eq("dealer_id", dealer.id)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []) as Car[];
    },
    enabled: !!dealer?.id,
  });

  if (dealerLoading || carsLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-10">Loading dealer profile...</main>
        <Footer />
      </div>
    );
  }

  if (dealerError) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-10 text-red-600">
          Unable to load dealer profile.
        </main>
        <Footer />
      </div>
    );
  }

  if (!dealer) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-10">Dealer not found.</main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-10">
          <Link
            to="/dealers"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to dealers
          </Link>

          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-40 h-40 rounded-xl border bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                {dealer.company_logo ? (
                  <img
                    src={dealer.company_logo}
                    alt={`${dealer.full_name} logo`}
                    className="w-full h-full object-contain p-3"
                  />
                ) : (
                  <div className="text-gray-500 text-sm">No logo</div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold">{dealer.full_name}</h1>
                  {dealer.status === "verified" && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>

                {dealer.company_name && (
                  <p className="mt-2 text-lg text-gray-700">{dealer.company_name}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                  {dealer.country && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" /> {dealer.country}
                    </span>
                  )}
                  <span>
                    Dealer since {new Date(dealer.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {dealer.phone && (
                    <>
                      <a
                        href={buildWhatsappUrl(dealer.phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                      >
                        <Phone className="w-4 h-4" /> WhatsApp
                      </a>
                      <a
                        href={`tel:${dealer.phone}`}
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                      >
                        <Phone className="w-4 h-4" /> Call
                      </a>
                    </>
                  )}
                  <a
                    href={`mailto:${dealer.email}`}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    <Mail className="w-4 h-4" /> Email
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t pt-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-2xl font-semibold">Cars created by this dealer</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Showing {cars.length} car{cars.length === 1 ? "" : "s"}.
                  </p>
                </div>
              </div>

              {cars.length === 0 ? (
                <div className="mt-6 rounded-lg border border-dashed bg-gray-50 p-8 text-center text-gray-600">
                  This dealer has not created any cars yet.
                </div>
              ) : (
                <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
                  {cars.map((car) => (
                    <div
                      key={car.id}
                      className="overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                      <Link
                        to={`/cars/${carSlug(car)}`}
                        className="block"
                      >
                        <div className="h-36 bg-gray-100">
                          {car.gallery?.[0] ? (
                            <img
                              src={car.gallery[0]}
                              alt={`${car.make} ${car.model}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-gray-500">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <p className="text-sm text-gray-500">
                            {car.year || ""} {car.year ? "•" : ""} {car.location || "Unknown location"}
                          </p>
                          <h3 className="mt-1 font-semibold text-lg">
                            {car.make} {car.model}
                          </h3>
                          <p className="mt-2 text-sm text-gray-600">
                            {formatPrice(Number(car.price))}
                          </p>
                        </div>
                      </Link>
                      <div className="border-t px-4 pb-4 pt-3">
                        <ShareActions
                          compact
                          url={`/cars/${carSlug(car)}`}
                          carId={car.id}
                          title={`${car.year ?? ""} ${car.make} ${car.model}`}
                          description={`Check out this ${car.year ?? ""} ${car.make} ${car.model} for ${formatPrice(
                            Number(car.price)
                          )} in ${car.location ?? "Kenya"}.`}
                          imageUrl={car.gallery?.[0] ?? "/placeholder-car.jpg"}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DealerProfile;
