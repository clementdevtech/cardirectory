import React, { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, Phone, Mail, CheckCircle } from "lucide-react";

interface Dealer {
  id: string;
  full_name: string;
  company_name?: string;
  email: string;
  phone?: string;
  country?: string;
  status: string;
  created_at: string;
  cars?: {
    id: number;
    gallery: string[];
    make: string;
    model: string;
    price: number;
  }[];
}

const Dealers: React.FC = () => {
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [page, setPage] = useState(1);
  const limit = 6;

  // 🚀 Fetch dealers and their cars
  const { data: dealers, isLoading } = useQuery<Dealer[]>({
    queryKey: ["dealers-with-cars"],
    queryFn: async () => {
      // ✅ Get all dealers
      const { data: dealerData, error: dealerError } = await supabase
        .from("dealers")
        .select("id, full_name, company_name, email, phone, country, status, created_at");

      if (dealerError) throw dealerError;

      // ✅ Fetch each dealer's cars
      const dealerIds = dealerData.map((d) => d.id);
      const { data: carsData, error: carsError } = await supabase
        .from("cars")
        .select("id, dealer_id, gallery, make, model, price, status")
        .in("dealer_id", dealerIds)
        .eq("status", "active");

      if (carsError) throw carsError;

      // ✅ Combine dealers + cars
      const dealersWithCars = dealerData.map((dealer) => ({
        ...dealer,
        cars: carsData?.filter((car) => car.dealer_id === dealer.id) || [],
      }));

      return dealersWithCars;
    },
  });

  // 🔍 Search, filter, and paginate
  const filteredDealers = useMemo(() => {
    if (!dealers) return [];
    return dealers
      .filter(
        (d) =>
          d.full_name.toLowerCase().includes(search.toLowerCase()) &&
          (filterCountry ? d.country === filterCountry : true)
      )
      .slice((page - 1) * limit, page * limit);
  }, [dealers, search, filterCountry, page]);

  // 🌍 Unique country list
  const countries = useMemo(
    () => Array.from(new Set(dealers?.map((d) => d.country).filter(Boolean))),
    [dealers]
  );

  // 🦴 Loading placeholder
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse border rounded-lg shadow-sm">
              <div className="bg-gray-200 h-48" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold mb-6 text-center">
              🚗 Verified Dealers
            </h1>

            {/* 🔍 Search & Filter */}
            <div className="flex flex-col md:flex-row gap-4 justify-center mb-8">
              <input
                type="text"
                placeholder="Search dealer by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border px-4 py-2 rounded-md w-full md:w-1/3"
              />
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="border px-4 py-2 rounded-md w-full md:w-1/4"
              >
                <option value="">All Countries</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* 💎 Dealer Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDealers.map((d) => (
                <div
                  key={d.id}
                  className="border rounded-lg shadow-sm hover:shadow-lg transition bg-white overflow-hidden"
                >
                  {/* 🏢 Dealer Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {d.full_name}
                      {d.status === "approved" && (
                        <CheckCircle className="text-green-500 w-5 h-5" />
                      )}
                    </h3>
                    {d.company_name && (
                      <p className="text-sm text-gray-600">{d.company_name}</p>
                    )}
                    <p className="text-sm text-gray-600 flex items-center mt-1">
                      <MapPin className="w-4 h-4 mr-1" /> {d.country || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Dealer since {new Date(d.created_at).toLocaleDateString()}
                    </p>

                    {/* 📞 Contact Buttons */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {d.phone && (
                        <>
                          <a
                            href={`https://wa.me/${d.phone.replace(/\s/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 px-3 py-2 border rounded hover:bg-green-100"
                          >
                            <img
                              src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
                              alt="WhatsApp"
                              className="w-4 h-4"
                            />
                            WhatsApp
                          </a>
                          <a
                            href={`tel:${d.phone}`}
                            className="flex items-center gap-1 px-3 py-2 border rounded hover:bg-blue-100"
                          >
                            <Phone className="w-4 h-4" /> Call
                          </a>
                        </>
                      )}
                      <a
                        href={`mailto:${d.email}`}
                        className="flex items-center gap-1 px-3 py-2 border rounded hover:bg-gray-100"
                      >
                        <Mail className="w-4 h-4" /> Email
                      </a>
                    </div>
                  </div>

                  {/* 🚘 Dealer’s Cars Preview */}
                  {d.cars && d.cars.length > 0 && (
                    <div className="border-t bg-gray-50">
                      <div className="flex overflow-x-auto gap-3 p-3 scrollbar-hide">
                        {d.cars.map((car) => (
                          <div key={car.id} className="min-w-[150px] rounded-lg overflow-hidden bg-white shadow-sm">
                            {car.gallery?.[0] ? (
                              <img
                                src={car.gallery[0]}
                                alt={`${car.make} ${car.model}`}
                                className="w-full h-24 object-cover"
                              />
                            ) : (
                              <div className="bg-gray-200 w-full h-24 flex items-center justify-center text-xs text-gray-500">
                                No Image
                              </div>
                            )}
                            <div className="p-2 text-center">
                              <p className="text-sm font-medium">
                                {car.make} {car.model}
                              </p>
                              <p className="text-xs text-gray-600">
                                KES {Number(car.price).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 📄 Pagination */}
            <div className="flex justify-center mt-8 gap-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setPage((p) =>
                    dealers && p * limit < dealers.length ? p + 1 : p
                  )
                }
                disabled={dealers && page * limit >= dealers.length}
                className="px-4 py-2 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Dealers;
