import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Car, Menu, X, LogOut, LayoutDashboard } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
 //console.log(user, userRole, signOut);
  // ✅ Handle Logout
  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // ✅ Handle Get Started
  const handleGetStarted = () => {
    navigate(authMode === "login" ? "/login" : "/register");
  };

  // ✅ Swipe-to-close functionality for mobile panel
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => setTouchStartX(e.touches[0].clientX);
    const handleTouchMove = (e: TouchEvent) => setTouchEndX(e.touches[0].clientX);
    const handleTouchEnd = () => {
      if (touchStartX - touchEndX > 70) setMobileMenuOpen(false); // swipe left to close
    };

    const panel = panelRef.current;
    if (panel) {
      panel.addEventListener("touchstart", handleTouchStart);
      panel.addEventListener("touchmove", handleTouchMove);
      panel.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      if (panel) {
        panel.removeEventListener("touchstart", handleTouchStart);
        panel.removeEventListener("touchmove", handleTouchMove);
        panel.removeEventListener("touchend", handleTouchEnd);
      }
    };
  }, [touchStartX, touchEndX]);

  return (
    <nav
      className="fixed top-0 left-0 w-full z-50 border-b border-border transition-all
      bg-background md:bg-background/95 md:backdrop-blur-md"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="gradient-hero p-2 rounded-lg">
              <Car className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-heading text-xl font-bold">
              Car<span className="text-primary">Directory</span>
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/cars" className="nav-link">Browse Cars</Link>
            <Link to="/dealers" className="nav-link">Dealers</Link>
            <Link to="/pricing" className="nav-link">Pricing</Link>
            <Link to="/contact" className="nav-link">Contact</Link>

            {userRole === "admin" && (
              <Link to="/admin" className="flex items-center gap-1 text-primary font-medium">
                <LayoutDashboard size={16} /> Admin Panel
              </Link>
            )}

            {userRole === "dealer" && (
              <Link to="/dealer" className="flex items-center gap-1 text-primary font-medium">
                <LayoutDashboard size={16} /> Dealer Dashboard
              </Link>
            )}
          </div>

          {/* Desktop Right Side */}
          <div className="hidden md:flex items-center space-x-3">
            {user ? (
              <>
                <Link to="/post-vehicle">
                  <Button variant="hero">Sell Your Car</Button>
                </Link>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <LogOut size={16} /> Logout
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 border border-border rounded-full px-3 py-2 shadow-sm transition-all">
                <Label htmlFor="authMode" className="text-sm text-gray-700 font-medium">
                  {authMode === "login" ? "Login" : "Register"}
                </Label>
                <Switch
                  id="authMode"
                  checked={authMode === "register"}
                  onCheckedChange={(checked) => setAuthMode(checked ? "register" : "login")}
                  className="data-[state=checked]:bg-primary transition-all"
                />
                <Button
                  onClick={handleGetStarted}
                  variant="hero"
                  className="rounded-full px-5 font-semibold"
                >
                  Get Started
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm md:hidden z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-3/4 bg-background border-l border-border shadow-xl transform transition-transform duration-300 ease-in-out md:hidden z-50 ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-700">Menu</h2>
          <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col text-left px-6 py-5 space-y-5">
          <Link to="/cars" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>
            Browse Cars
          </Link>
          <Link to="/dealers" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>
            Dealers
          </Link>
          <Link to="/pricing" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>
            Pricing
          </Link>
          <Link to="/contact" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>
            Contact
          </Link>

          {userRole === "admin" && (
            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 text-primary font-semibold"
            >
              <LayoutDashboard size={16} /> Admin Panel
            </Link>
          )}

          {userRole === "dealer" && (
            <Link
              to="/dealer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 text-primary font-semibold"
            >
              <LayoutDashboard size={16} /> Dealer Dashboard
            </Link>
          )}

          {user ? (
            <>
              <Link to="/post-vehicle" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="hero" className="w-full">Sell Your Car</Button>
              </Link>
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
              >
                <LogOut size={16} /> Logout
              </Button>
            </>
          ) : (
            <div className="flex flex-col gap-4 bg-gray-50 w-full p-4 rounded-xl border border-border mt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="authModeMobile" className="text-sm text-gray-700 font-medium">
                  {authMode === "login" ? "Login" : "Register"}
                </Label>
                <Switch
                  id="authModeMobile"
                  checked={authMode === "register"}
                  onCheckedChange={(checked) => setAuthMode(checked ? "register" : "login")}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleGetStarted();
                }}
                variant="hero"
                className="w-full font-semibold"
              >
                Get Started
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
