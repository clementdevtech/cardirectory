import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BriefcaseBusiness, Car, CircleDollarSign, PlusCircle, Sparkles, ShieldCheck } from "lucide-react";

const API_BASE = (import.meta.env.VITE_BACKEND_URL as string);

const SalesDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    dealersBrought: 0,
    activeDealers: 0,
    commissionEarned: 0,
    commissions: [] as any[],
    dealers: [] as any[],
    dealerCars: [] as any[],
  });
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("admin-theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem("admin-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/admin/sales-dashboard/${user.id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load sales dashboard");
        setStats({
          dealersBrought: data.dealersBrought || 0,
          activeDealers: data.activeDealers || 0,
          commissionEarned: Number(data.commissionEarned || 0),
          commissions: data.commissions || [],
          dealers: data.dealers || [],
          dealerCars: data.dealerCars || [],
        });
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]);

  const shellClass = isDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";
  const panelClass = isDarkMode ? "border-slate-800 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900";
  const mutedTextClass = isDarkMode ? "text-slate-400" : "text-slate-500";
  const pillClass = isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-200 bg-slate-100 text-slate-600";

  return (
    <div className={`min-h-screen ${shellClass}`}>
      <Navbar />
      <main className={`container mx-auto px-4 py-10 space-y-6 ${shellClass}`}>
        <div className={`rounded-2xl border p-6 shadow-sm ${panelClass}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-sm ${pillClass}`}>
                  <Sparkles className="mr-1 inline h-4 w-4" /> Sales workspace
                </span>
                <span className={`rounded-full border px-3 py-1 text-sm ${pillClass}`}>
                  <ShieldCheck className="mr-1 inline h-4 w-4" /> Dealer-focused view
                </span>
              </div>
              <h1 className="text-3xl font-bold">Sales Person Dashboard</h1>
              <p className={`mt-2 ${mutedTextClass}`}>Track your dealer referrals, active accounts, commission payouts, and recent inventory activity.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setIsDarkMode((prev) => !prev)}>
                {isDarkMode ? "Light mode" : "Dark mode"}
              </Button>
              <Button onClick={() => navigate("/admin")}>Go to admin panel</Button>
            </div>
          </div>
        </div>

        {loading ? (
          <p>Loading dashboard...</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className={`p-6 ${panelClass}`}>
                <div className={`flex items-center gap-2 ${mutedTextClass}`}>
                  <BriefcaseBusiness className="h-4 w-4" />
                  <p className="text-sm">Dealers brought</p>
                </div>
                <p className="mt-3 text-3xl font-bold">{stats.dealersBrought}</p>
              </Card>
              <Card className={`p-6 ${panelClass}`}>
                <div className={`flex items-center gap-2 ${mutedTextClass}`}>
                  <BriefcaseBusiness className="h-4 w-4" />
                  <p className="text-sm">Active dealers</p>
                </div>
                <p className="mt-3 text-3xl font-bold">{stats.activeDealers}</p>
              </Card>
              <Card className={`p-6 ${panelClass}`}>
                <div className={`flex items-center gap-2 ${mutedTextClass}`}>
                  <CircleDollarSign className="h-4 w-4" />
                  <p className="text-sm">Commission earned</p>
                </div>
                <p className="mt-3 text-3xl font-bold">KES {Number(stats.commissionEarned).toLocaleString()}</p>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Your dealers</h2>
                  <Button variant="outline" size="sm" onClick={() => navigate("/admin#dealers")}>
                    <PlusCircle className="mr-1 h-4 w-4" /> Manage
                  </Button>
                </div>
                {stats.dealers.length === 0 ? (
                  <p className={mutedTextClass}>No dealers assigned yet.</p>
                ) : (
                  <div className="space-y-3">
                    {stats.dealers.map((dealer: any) => (
                      <div key={dealer.id} className={`rounded-lg border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">{dealer.full_name}</p>
                            <p className={`text-sm ${mutedTextClass}`}>{dealer.company_name || dealer.email}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs uppercase ${pillClass}`}>{dealer.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Recent vehicle activity</h2>
                  <Button variant="outline" size="sm" onClick={() => navigate("/admin#inventory")}>
                    <Car className="mr-1 h-4 w-4" /> Open inventory
                  </Button>
                </div>
                {stats.dealerCars.length === 0 ? (
                  <p className={mutedTextClass}>No vehicles have been added for your dealers yet.</p>
                ) : (
                  <div className="space-y-3">
                    {stats.dealerCars.map((car: any) => (
                      <div key={car.id} className={`rounded-lg border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">{car.make} {car.model} ({car.year})</p>
                            <p className={`text-sm ${mutedTextClass}`}>{car.dealer_name}{car.company_name ? ` • ${car.company_name}` : ""}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs uppercase ${pillClass}`}>{car.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Recent commission activity</h2>
              {stats.commissions.length === 0 ? (
                <p className={mutedTextClass}>No commissions recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {stats.commissions.map((item: any) => (
                    <div key={item.id} className={`flex items-center justify-between rounded-lg border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                      <div>
                        <p className="font-medium">{item.package_name || "Package"}</p>
                        <p className={`text-sm ${mutedTextClass}`}>{new Date(item.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">KES {Number(item.commission_amount || 0).toLocaleString()}</p>
                        <p className={`text-sm ${mutedTextClass} uppercase`}>{item.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default SalesDashboard;
