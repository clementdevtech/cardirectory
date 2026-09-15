import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = (import.meta.env.VITE_BACKEND_URL as string) || "";
const ADMIN_API = API_BASE.endsWith("/admin") ? API_BASE : `${API_BASE}/admin`;

const HeroSection = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const [heroVideos, setHeroVideos] = useState<string[]>([]);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const loadHeroSettings = async () => {
      try {
        if (!API_BASE) return;
        const response = await axios.get(`${ADMIN_API}/site-config`);
        const settings = response.data || {};
        setHeroImage(settings.hero_image_url || "");
        setHeroVideos([settings.hero_video_url, settings.hero_video_url_2].filter(Boolean));
      } catch (error) {
        console.error("Failed to load hero settings", error);
      }
    };

    loadHeroSettings();
  }, []);

  useEffect(() => {
    setActiveVideoIndex(0);
  }, [heroVideos.length]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/cars?search=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <section className="relative min-h-[50vh] w-full overflow-hidden">
      <div className="absolute inset-0 bg-black/40" />

      <div className="absolute inset-0">
            {heroVideos.length > 0 ? (
              <div className="relative h-full w-full overflow-hidden bg-black">
                <video
                  key={heroVideos[activeVideoIndex]}
                  src={heroVideos[activeVideoIndex]}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop={heroVideos.length === 1}
                  playsInline
                  onEnded={() => setActiveVideoIndex((index) => (index + 1) % heroVideos.length)}
                />
            </div>
            ) : heroImage ? (
              <div className="relative h-full w-full overflow-hidden">
                <img
                  src={heroImage}
                  alt="CarDirectory hero"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="relative h-full w-full overflow-hidden bg-gradient-to-r from-primary/80 via-primary/40 to-accent/60" />
            )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/20" />

      <div className="container relative z-10 mx-auto flex min-h-[50vh] items-center px-4 py-12 md:py-16">
        <div className="max-w-4xl space-y-8 text-white">

          <h1 className="font-heading text-4xl md:text-6xl font-bold leading-tight">
            Buy & Sell Cars in Kenya{" "}
            <span className="text-primary">Fast, Safe & Secure</span>
          </h1>

          <p className="max-w-2xl text-lg text-white/85 md:text-xl">
            Browse thousands of verified cars from trusted dealers across Kenya. Find your perfect ride today.
          </p>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="flex gap-2 rounded-lg border border-white/30 bg-white/95 p-2 shadow-card-hover">
              <div className="flex-1 flex items-center gap-2 px-4">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by make, model, or location..."
                  className="border-0 bg-transparent text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit" variant="hero" size="lg">
                Search Cars
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-white/75">Popular:</span>
            {["Toyota", "Nissan", "Subaru", "Mazda"].map((brand) => (
              <button
                key={brand}
                onClick={() => navigate(`/cars?make=${brand}`)}
                className="rounded-full bg-white/15 px-3 py-1 text-sm text-white backdrop-blur-sm transition-smooth hover:bg-primary hover:text-primary-foreground"
              >
                {brand}
              </button>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};

export default HeroSection;
