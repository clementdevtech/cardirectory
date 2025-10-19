import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/cars?search=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <section className="relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 gradient-hero opacity-10"></div>
      
      <div className="container relative mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Main Heading */}
          <h1 className="font-heading text-4xl md:text-6xl font-bold leading-tight">
            Buy & Sell Cars in Kenya{" "}
            <span className="text-primary">Fast, Safe & Secure</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Browse thousands of verified cars from trusted dealers across Kenya. Find your perfect ride today.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="flex gap-2 p-2 bg-card rounded-lg shadow-card-hover border border-border">
              <div className="flex-1 flex items-center gap-2 px-4">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by make, model, or location..."
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit" variant="hero" size="lg">
                Search Cars
              </Button>
            </div>
          </form>

          {/* Popular Searches */}
          <div className="flex flex-wrap gap-2 justify-center">
            <span className="text-sm text-muted-foreground">Popular:</span>
            {["Toyota", "Nissan", "Subaru", "Mazda"].map((brand) => (
              <button
                key={brand}
                onClick={() => navigate(`/cars?make=${brand}`)}
                className="text-sm px-3 py-1 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-smooth"
              >
                {brand}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-8">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-heading font-bold text-primary">5000+</div>
              <div className="text-sm text-muted-foreground mt-1">Active Listings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-heading font-bold text-primary">500+</div>
              <div className="text-sm text-muted-foreground mt-1">Verified Dealers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-heading font-bold text-primary">10K+</div>
              <div className="text-sm text-muted-foreground mt-1">Happy Buyers</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
