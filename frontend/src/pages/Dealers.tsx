import React, { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Star, MapPin, Phone, Mail, CheckCircle } from "lucide-react";

// ✅ Strong type definition for Dealer
interface Dealer {
  id: string;
  name: string;
  images: string[]; // multiple gallery images
  video?: string; // optional video URL (under 20MB)
  location: string;
  phone: string;
  email?: string;
  rating?: number;
  verified?: boolean;
  latitude?: number;
  longitude?: number;
}

const Dealers: React.FC = () => {
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [page, setPage] = useState(1);
  const limit = 6;

  // 🚀 Fetch dealers from Supabase
  const { data: dealers, isLoading } = useQuery<Dealer[]>({
    queryKey: ["dealers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dealers").select("*");
      if (error) throw error;

      // 🧩 Normalize images (string → array if needed)
      return (
        data?.map((d: any) => ({
          ...d,
          images:
            typeof d.images === "string"
              ? JSON.parse(d.images)
              : d.images || [],
        })) || []
      );
    },
  });

  // 🔍 Search + filter + pagination
  const filteredDealers = useMemo(() => {
    if (!dealers) return [];
    return dealers
      .filter(
        (d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) &&
          (filterLocation ? d.location === filterLocation : true)
      )
      .slice((page - 1) * limit, page * limit);
  }, [dealers, search, filterLocation, page]);

  // 🌍 Unique locations
  const locations = useMemo(
    () => Array.from(new Set(dealers?.map((d) => d.location))),
    [dealers]
  );

  // 🦴 Loading state
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
              🚗 Trusted Dealers
            </h1>

            {/* 🔍 Search & Filter */}
            <div className="flex flex-col md:flex-row gap-4 justify-center mb-8">
              <input
                type="text"
                placeholder="Search dealer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border px-4 py-2 rounded-md w-full md:w-1/3"
              />
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="border px-4 py-2 rounded-md w-full md:w-1/4"
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
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
                  {/* 🖼️ Gallery */}
                  <div className="relative w-full h-48 overflow-hidden group">
                    {d.images && d.images.length > 0 ? (
                      <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                        {d.images.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt={`${d.name} image ${i + 1}`}
                            className="object-cover w-full h-48 snap-center flex-shrink-0"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-100 h-48 flex items-center justify-center text-gray-400">
                        No images available
                      </div>
                    )}
                  </div>

                  {/* 🎥 Short Video Preview */}
                  {d.video && (
                    <video
                      controls
                      className="w-full mt-2 rounded-md max-h-60"
                      preload="none"
                      playsInline
                    >
                      <source src={d.video} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  )}

                  {/* 📋 Info */}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        {d.name}
                        {d.verified && (
                          <CheckCircle className="text-green-500 w-5 h-5" />
                        )}
                      </h3>
                      <div className="flex text-yellow-500">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            fill={i < (d.rating || 0) ? "currentColor" : "none"}
                            strokeWidth={1.5}
                            className="w-4 h-4"
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 flex items-center mt-2">
                      <MapPin className="w-4 h-4 mr-1" /> {d.location}
                    </p>

                    {/* 📞 Contact Buttons */}
                    <div className="mt-4 flex flex-wrap gap-2">
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
                      {d.email && (
                        <a
                          href={`mailto:${d.email}`}
                          className="flex items-center gap-1 px-3 py-2 border rounded hover:bg-gray-100"
                        >
                          <Mail className="w-4 h-4" /> Email
                        </a>
                      )}
                    </div>

                    {/* 🗺️ Map Preview */}
                    {d.latitude && d.longitude && (
                      <iframe
                        src={`https://www.google.com/maps?q=${d.latitude},${d.longitude}&z=15&output=embed`}
                        width="100%"
                        height="150"
                        className="mt-3 rounded-md"
                        loading="lazy"
                      ></iframe>
                    )}
                  </div>
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