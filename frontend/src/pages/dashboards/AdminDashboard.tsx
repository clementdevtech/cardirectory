import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import CarForm from "@/components/CarForm";
import DealerForm from "@/components/DealerForm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Car as CarIcon,
  Upload,
  Star,
  Trash2,
  UserPlus,
  UserX,
  Edit,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Package,
  Users,
  BarChart3,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Bell,
  Search,
  ShieldCheck,
  Moon,
  Sun,
  SlidersHorizontal,
  ArrowUpDown,
  Sparkles,
  Download,
} from "lucide-react";
import { Dialog } from "@headlessui/react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { useCarForm } from "@/hooks/useCarForm";
import { useCarUploads } from "@/hooks/useCarUploads";
import { useLocationSearch } from "@/hooks/useLocationSearch";
import { useAuth } from "@/hooks/useAuth";

type Car = {
  id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  location?: string;
  description?: string;
  condition?: string;
  featured?: boolean;
  status?: string;
  gallery?: string[];
  video_url?: string;
  transmission?: string;
  phone?: string;
  dealer_id?: string | null;
  created_at?: string;
};

type Dealer = {
  id: string;
  full_name: string;
  company_name?: string;
  email: string;
  phone?: string;
  created_at?: string;
  company_logo?: string;
};

// env & api
const API_BASE = (import.meta.env.VITE_BACKEND_URL as string);
const ADMIN_API = API_BASE.endsWith("/admin") ? API_BASE : `${API_BASE}/admin`;
const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string;

const getStoredAuthToken = () => {
  return localStorage.getItem("auth_token") || localStorage.getItem("token") || "";
};

const axiosInstance = axios.create({
  baseURL: ADMIN_API,
  withCredentials: true,
});
axiosInstance.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type DashboardView = "overview" | "inventory" | "dealers" | "users";
type ChartRange = "all" | "30d" | "7d";

const AdminDashboard: React.FC = () => {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();

  const [cars, setCars] = useState<Car[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingUser, setSavingUser] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalListings: 0,
    pendingApproval: 0,
    totalDealers: 0,
    totalRevenue: 0,
  });
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [chartRange, setChartRange] = useState<ChartRange>("all");
  const [sidebarGroups, setSidebarGroups] = useState({ insights: true, management: true });
  const [carsPage, setCarsPage] = useState(1);
  const [dealersPage, setDealersPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("admin-theme") === "dark";
  });
  const [carSearch, setCarSearch] = useState("");
  const [carStatusFilter, setCarStatusFilter] = useState<"all" | "active" | "pending" | "removed">("all");
  const [dealerSearch, setDealerSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "admin" | "dealer" | "salesperson" | "user">("all");
  const [globalSearch, setGlobalSearch] = useState("");
  const [carSort, setCarSort] = useState<{ key: "make" | "price" | "year"; direction: "asc" | "desc" }>({ key: "make", direction: "asc" });
  const [dealerSort, setDealerSort] = useState<{ key: "full_name" | "created_at"; direction: "asc" | "desc" }>({ key: "full_name", direction: "asc" });
  const [userSort, setUserSort] = useState<{ key: "full_name" | "role" | "created_at"; direction: "asc" | "desc" }>({ key: "full_name", direction: "asc" });
  const [carQuickFilter, setCarQuickFilter] = useState<"all" | "new" | "pending" | "featured">("all");
  const [dealerQuickFilter, setDealerQuickFilter] = useState<"all" | "new">("all");
  const [userQuickFilter, setUserQuickFilter] = useState<"all" | "new">("all");
  const [emailCampaignSubject, setEmailCampaignSubject] = useState("");
  const [emailCampaignBody, setEmailCampaignBody] = useState("");
  const [emailCampaignType, setEmailCampaignType] = useState<"one-to-one" | "mass">("mass");
  const [emailCampaignRecipients, setEmailCampaignRecipients] = useState("");
  const pageSize = 10;
  const [selectedEmailUser, setSelectedEmailUser] = useState<string>("");
  const [emailCampaignStatus, setEmailCampaignStatus] = useState<string>("");

  const navigationItems = [
    { id: "overview", label: "Overview", description: "Summary and insights", icon: BarChart3 },
    { id: "inventory", label: "Inventory", description: "Cars and approvals", icon: Package },
    { id: "dealers", label: "Dealers", description: "Dealer accounts", icon: UserPlus },
    { id: "users", label: "Users", description: "Roles and commissions", icon: Users },
  ];

  const shellClass = isDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";
  const panelClass = isDarkMode ? "border-slate-800 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900";
  const mutedTextClass = isDarkMode ? "text-slate-400" : "text-slate-500";
  const subtleTextClass = isDarkMode ? "text-slate-300" : "text-slate-600";
  const pillClass = isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-200 bg-slate-100 text-slate-600";
  const inputClass = isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-400" : "border-slate-200 bg-white text-slate-900";
  const activeFilterClass = isDarkMode ? "border-emerald-500 bg-emerald-500/15 text-emerald-400" : "border-emerald-500 bg-emerald-50 text-emerald-700";

  const isNewItem = (createdAt?: string) => {
    if (!createdAt) return false;
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return false;
    return date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  };

  const exportRowsToCsv = (filename: string, rows: Array<Record<string, unknown>>) => {
    if (!rows.length) return;
    const header = Object.keys(rows[0]);
    const csvContent = [header.join(",")].concat(rows.map((row) => header.map((key) => `${row[key] ?? ""}`.replace(/\n/g, " ")).join(","))).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filterItemsByRange = <T extends { created_at?: string }>(items: T[]) => {
    if (chartRange === "all") return items;

    const now = new Date();
    const days = chartRange === "30d" ? 30 : 7;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return items.filter((item) => {
      if (!item.created_at) return true;
      const createdAt = new Date(item.created_at);
      return !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
    });
  };

  const listingStatusData = useMemo(() => {
    const filteredCars = filterItemsByRange(cars);
    const counts = filteredCars.reduce(
      (acc, car) => {
        const status = (car.status || "active").toLowerCase();
        if (status === "pending") acc.pending += 1;
        else if (status === "removed") acc.removed += 1;
        else acc.active += 1;
        return acc;
      },
      { active: 0, pending: 0, removed: 0 }
    );

    return [
      { name: "Active", value: counts.active, color: "#10b981" },
      { name: "Pending", value: counts.pending, color: "#f59e0b" },
      { name: "Removed", value: counts.removed, color: "#ef4444" },
    ];
  }, [cars, chartRange]);

  const userRoleData = useMemo(() => {
    const filteredUsers = filterItemsByRange(users);
    const counts = filteredUsers.reduce(
      (acc, user) => {
        const role = (user.role || "user").toLowerCase();
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: name === "admin" ? "#6366f1" : name === "dealer" ? "#3b82f6" : name === "salesperson" ? "#14b8a6" : "#94a3b8",
    }));
  }, [users, chartRange]);

  const filteredCars = useMemo(() => {
    const query = (carSearch || globalSearch).trim().toLowerCase();
    return cars.filter((car) => {
      const matchesSearch =
        !query ||
        `${car.make} ${car.model} ${car.location || ""}`.toLowerCase().includes(query);
      const matchesStatus = carStatusFilter === "all" || (car.status || "active").toLowerCase() === carStatusFilter;
      const matchesQuickFilter =
        carQuickFilter === "all" ||
        (carQuickFilter === "new" && isNewItem(car.created_at)) ||
        (carQuickFilter === "pending" && (car.status || "active").toLowerCase() === "pending") ||
        (carQuickFilter === "featured" && car.featured);
      return matchesSearch && matchesStatus && matchesQuickFilter;
    });
  }, [carSearch, globalSearch, carStatusFilter, carQuickFilter, cars]);

  const filteredDealers = useMemo(() => {
    const query = (dealerSearch || globalSearch).trim().toLowerCase();
    return dealers.filter((dealer) => {
      const haystack = `${dealer.full_name} ${dealer.email} ${dealer.company_name || ""}`.toLowerCase();
      const matchesQuickFilter = dealerQuickFilter === "all" || (dealerQuickFilter === "new" && isNewItem(dealer.created_at));
      return (!query || haystack.includes(query)) && matchesQuickFilter;
    });
  }, [dealerSearch, globalSearch, dealerQuickFilter, dealers]);

  const filteredUsers = useMemo(() => {
    const query = (userSearch || globalSearch).trim().toLowerCase();
    return users.filter((userItem) => {
      const role = (userItem.role || "user").toLowerCase();
      const matchesRole = userRoleFilter === "all" || role === userRoleFilter;
      const matchesSearch =
        !query || `${userItem.full_name || ""} ${userItem.email || ""}`.toLowerCase().includes(query);
      const matchesQuickFilter = userQuickFilter === "all" || (userQuickFilter === "new" && isNewItem(userItem.created_at));
      return matchesRole && matchesSearch && matchesQuickFilter;
    });
  }, [userRoleFilter, userSearch, globalSearch, userQuickFilter, users]);

  const sortedCars = useMemo(() => {
    const items = [...filteredCars];
    items.sort((a, b) => {
      const direction = carSort.direction === "asc" ? 1 : -1;
      const valueA = a[carSort.key as keyof Car];
      const valueB = b[carSort.key as keyof Car];
      if (typeof valueA === "number" && typeof valueB === "number") {
        return (valueA - valueB) * direction;
      }
      return String(valueA).localeCompare(String(valueB)) * direction;
    });
    return items;
  }, [filteredCars, carSort]);

  const sortedDealers = useMemo(() => {
    const items = [...filteredDealers];
    items.sort((a, b) => {
      const direction = dealerSort.direction === "asc" ? 1 : -1;
      const valueA = a[dealerSort.key as keyof Dealer];
      const valueB = b[dealerSort.key as keyof Dealer];
      if (typeof valueA === "string" && typeof valueB === "string") {
        return valueA.localeCompare(valueB) * direction;
      }
      return 0;
    });
    return items;
  }, [filteredDealers, dealerSort]);

  const sortedUsers = useMemo(() => {
    const items = [...filteredUsers];
    items.sort((a, b) => {
      const direction = userSort.direction === "asc" ? 1 : -1;
      const valueA = a[userSort.key as keyof typeof a];
      const valueB = b[userSort.key as keyof typeof b];
      if (typeof valueA === "string" && typeof valueB === "string") {
        return valueA.localeCompare(valueB) * direction;
      }
      return 0;
    });
    return items;
  }, [filteredUsers, userSort]);

  const pagedCars = useMemo(() => {
    const start = (carsPage - 1) * pageSize;
    return sortedCars.slice(start, start + pageSize);
  }, [sortedCars, carsPage]);

  const pagedDealers = useMemo(() => {
    const start = (dealersPage - 1) * pageSize;
    return sortedDealers.slice(start, start + pageSize);
  }, [sortedDealers, dealersPage]);

  const pagedUsers = useMemo(() => {
    const start = (usersPage - 1) * pageSize;
    return sortedUsers.slice(start, start + pageSize);
  }, [sortedUsers, usersPage]);

  const totalCarPages = Math.max(1, Math.ceil(filteredCars.length / pageSize));
  const totalDealerPages = Math.max(1, Math.ceil(filteredDealers.length / pageSize));
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));

  const newUsersCount = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return users.filter((userItem) => {
      if (!userItem.created_at) return false;
      const createdAt = new Date(userItem.created_at);
      return !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
    }).length;
  }, [users]);

  const globalSearchResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query) return { cars: 0, dealers: 0, users: 0 };
    return {
      cars: cars.filter((car) => `${car.make} ${car.model} ${car.location || ""}`.toLowerCase().includes(query)).length,
      dealers: dealers.filter((dealer) => `${dealer.full_name} ${dealer.email} ${dealer.company_name || ""}`.toLowerCase().includes(query)).length,
      users: users.filter((userItem) => `${userItem.full_name || ""} ${userItem.email || ""} ${userItem.role || ""}`.toLowerCase().includes(query)).length,
    };
  }, [globalSearch, cars, dealers, users]);

  const changeView = (view: DashboardView) => {
    setActiveView(view);
    window.history.replaceState({}, "", `#${view}`);
  };

  const handleCreateForDealer = (dealer: Dealer) => {
    setActiveView("inventory");
    window.history.replaceState({}, "", "#inventory");
    clearEdit();
    setForm({
      ...form,
      dealer_id: dealer.id,
      make: "",
      model: "",
      year: 0,
      mileage: 0,
      price: 0,
      location: "",
      phone: "",
      description: "",
      featured: false,
      gallery: [],
      video_url: "",
      status: "pending",
    });
    resetUploads();
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast({ title: "Create vehicle", description: `Ready to add a car for ${dealer.full_name}` });
  };

  const toggleSidebarGroup = (group: "insights" | "management") => {
    setSidebarGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  // hooks
  const { form, setForm, editId, startEdit, resetForm, clearEdit } = useCarForm();
  const {
    galleryPreview,
    galleryProgress,
    selectGalleryFiles,
    uploadAssets,
    resetUploads,
    setVideoFile,
  } = useCarUploads();
  const {
    query: locationQuery,
    setQuery: setLocationQuery,
    suggestions,
    isFetching,
  } = useLocationSearch(GEOAPIFY_API_KEY);

  // lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const openLightbox = (images: string[], startIndex = 0) => {
    setLightboxImages(images);
    setCurrentIndex(startIndex);
    setLightboxOpen(true);
  };
  const nextImage = () => setCurrentIndex((i) => (i + 1) % lightboxImages.length);
  const prevImage = () =>
    setCurrentIndex((i) => (i === 0 ? lightboxImages.length - 1 : i - 1));

  // fetch data
  const fetchDashboardData = async () => {
    try {
      const [carsRes, dealersRes, usersRes] = await Promise.all([
        axiosInstance.get<Car[]>('/cars'),
        axiosInstance.get<Dealer[]>('/dealers'),
        axiosInstance.get('/users'),
      ]);
      const carsData = carsRes.data || [];
      const dealersData = dealersRes.data || [];
      const usersData = usersRes.data || [];

      setCars(carsData);
      setDealers(dealersData);
      setUsers(usersData);

      const totalListings = carsData.length;
      const pendingApproval = carsData.filter((c) => c.status === "pending").length;
      const totalDealers = dealersData.length;

      let totalRevenue = 0;
      try {
        const token = getStoredAuthToken();
        const paymentsRes = await axios.get(`${API_BASE}/payments`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          withCredentials: true,
        });
        const payments = paymentsRes.data || [];
        totalRevenue =
          payments
            .filter((p: any) => p.status === "completed")
            .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0;
      } catch {
        totalRevenue = 0;
      }

      setStats({ totalListings, pendingApproval, totalDealers, totalRevenue });
    } catch (err: any) {
      console.error("Failed to load dashboard data:", err);
      toast({
        title: "Error loading data",
        description: err?.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleSelectEmailUser = (email: string) => {
    setSelectedEmailUser(email);
    setEmailCampaignType("one-to-one");
    setEmailCampaignRecipients(email);
    setActiveView("overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRunEmailCampaign = async () => {
    if (!emailCampaignSubject.trim() || !emailCampaignBody.trim()) {
      toast({ title: "Missing fields", description: "Subject and body are required.", variant: "destructive" });
      return;
    }

    const recipients = emailCampaignRecipients
      .split(/\r?\n|,|;/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!recipients.length) {
      toast({ title: "Missing recipients", description: "Enter at least one recipient email.", variant: "destructive" });
      return;
    }

    try {
      setEmailCampaignStatus(emailCampaignType === "one-to-one" ? "Sending email now..." : "Scheduling campaign...");
      const response = await axiosInstance.post("/email-campaign", {
        type: emailCampaignType,
        subject: emailCampaignSubject,
        body: emailCampaignBody,
        recipients,
        batchSize: 10,
        intervalMinutes: 5,
      });

      const data = response.data || {};
      if (emailCampaignType === "one-to-one") {
        const accepted = Number(data.accepted || recipients.length - (data.failed?.length || 0));
        const failed = data.failed || [];
        const failedMessage = failed.length ? ` Failed recipients: ${failed.map((failure: any) => failure.email).join(", ")}.` : "";
        const statusMessage = `Zoho accepted ${accepted} email(s). Delivery pending.${failedMessage}`;
        setEmailCampaignStatus(statusMessage);
        toast({ title: "Email accepted", description: statusMessage });
      } else {
        setEmailCampaignStatus(data.message || "Campaign scheduled successfully.");
        toast({ title: "Campaign scheduled", description: data.message || "Emails will be sent in batches every 5 minutes." });
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.response?.data?.error || err.message || "Failed to schedule campaign.";
      setEmailCampaignStatus(errorMessage);
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem("admin-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    setCarsPage(1);
  }, [carSearch, carStatusFilter]);

  useEffect(() => {
    setDealersPage(1);
  }, [dealerSearch]);

  useEffect(() => {
    setUsersPage(1);
  }, [userSearch, userRoleFilter]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as DashboardView;
    if (hash === "overview" || hash === "inventory" || hash === "dealers" || hash === "users") {
      setActiveView(hash);
    }
  }, []);

  // global event for lightbox (used by CarForm previews if you dispatch event)
  useEffect(() => {
    const handler = (e: any) => openLightbox(e.detail || []);
    window.addEventListener("open-lightbox", handler);
    return () => window.removeEventListener("open-lightbox", handler);
  }, []);

  // submit car (called from CarForm.onSubmit)
  const handleCarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.make || !form.model || !form.price) {
      toast({
        title: "Missing fields",
        description: "Please fill in make, model and price.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { galleryUrls, videoUrl } = await uploadAssets();

      const payload = {
        ...form,
        price: Number(form.price) || 0,
        year: Number(form.year) || 0,
        mileage: Number(form.mileage) || 0,
        gallery: [...(form.gallery || []), ...galleryUrls],
        video_url: videoUrl || form.video_url || "",
      };

      if (editId) {
        await axiosInstance.put(`/cars/${editId}`, payload);
        toast({ title: "Car updated successfully" });
      } else {
        await axiosInstance.post("/cars", payload);
        toast({ title: "Car added successfully" });
      }

      resetForm();
      resetUploads();
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Save failed",
        description: err?.response?.data?.message || err.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCar = async (id: number) => {
    if (!confirm("Are you sure you want to delete this car?")) return;
    try {
      await axiosInstance.delete(`/cars/${id}`);
      toast({ title: "Car deleted successfully" });
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.response?.data?.message || err.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleToggleFeatured = async (car: Car) => {
    try {
      await axiosInstance.patch(`/cars/${car.id}/featured`, { featured: !car.featured });
      toast({ title: "Updated", description: `${car.make} ${car.model}` });
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.response?.data?.message || err.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleApproval = async (id: number, status: "active" | "removed") => {
    try {
      await axiosInstance.patch(`/cars/${id}/status`, { status });
      toast({ title: "Success", description: `Car ${status}` });
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.response?.data?.message || err.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  // dealer flows (AdminDashboard will call API; DealerForm handles UI & base64 conversion)
  const handleCreateDealer = async (payload: any) => {
    try {
      await axiosInstance.post("/dealers", payload);
      toast({ title: "Dealer created successfully" });
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Error creating dealer",
        description: err?.response?.data?.message || err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleDeleteDealer = async (id: string) => {
    if (!confirm("Remove this dealer?")) return;
    try {
      await axiosInstance.delete(`/dealers/${id}`);
      toast({ title: "Dealer deleted successfully" });
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.response?.data?.message || err.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUser = async (userId: string, role: string, commissionRate: number) => {
    try {
      setSavingUser(userId);
      await axiosInstance.patch(`/users/${userId}`, { role, commission_rate: commissionRate });

      if (user?.id === userId) {
        await refreshUser();
      }

      localStorage.setItem("auth-role-updated", `${Date.now()}:${userId}`);
      window.dispatchEvent(new Event("auth-role-updated"));

      toast({ title: "User updated successfully" });
      fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Error updating user",
        description: err?.response?.data?.message || err.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setSavingUser(null);
    }
  };

  // when user clicks edit on a car: populate form
  const startEditCar = (car: Car) => {
    startEdit(car);
    // show existing images in preview
    if (car.gallery && car.gallery.length > 0) {
      window.dispatchEvent(new CustomEvent("open-lightbox", { detail: car.gallery }));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={`min-h-screen ${shellClass}`}>
      <main className={`pt-20 pb-16 ${shellClass}`}>
        <div className="container mx-auto px-4 lg:px-6">
          <div className={`mb-6 rounded-2xl border p-4 shadow-sm ${panelClass}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className={`flex items-center gap-2 text-sm font-medium ${mutedTextClass}`}>
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Admin control center
                </div>
                <h1 className={`mt-1 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Your operations overview</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${pillClass}`}>
                  <Bell className="h-4 w-4" /> {stats.pendingApproval} pending approvals
                </div>
                <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${pillClass}`}>
                  <Sparkles className="h-4 w-4" /> {newUsersCount} new users
                </div>
                <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${pillClass}`}>
                  <Users className="h-4 w-4" /> {stats.totalDealers} dealers
                </div>
                <button
                  onClick={() => setIsDarkMode((prev) => !prev)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${pillClass}`}
                >
                  {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {isDarkMode ? "Light mode" : "Dark mode"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${mutedTextClass}`} />
                <Input
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Search across admin panel"
                  className={`pl-9 ${inputClass}`}
                />
              </div>
              {globalSearch && (
                <div className={`rounded-full border px-3 py-1.5 text-sm ${pillClass}`}>
                  {globalSearchResults.cars > 0 ? `${globalSearchResults.cars} cars` : "No cars"} • {globalSearchResults.dealers > 0 ? `${globalSearchResults.dealers} dealers` : "No dealers"} • {globalSearchResults.users > 0 ? `${globalSearchResults.users} users` : "No users"}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => changeView(item.id as DashboardView)}
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${activeView === item.id ? (isDarkMode ? "bg-slate-100 text-slate-900" : "bg-slate-900 text-white") : (isDarkMode ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            <aside className="lg:w-72 lg:shrink-0">
              <Card className={`${panelClass} p-4 lg:sticky lg:top-24`}>
                <div className="mb-4 flex items-center gap-2">
                  <LayoutGrid className={`h-4 w-4 ${mutedTextClass}`} />
                  <h2 className="text-lg font-semibold">Admin menu</h2>
                </div>

                <div className="space-y-3">
                  <div className={`rounded-lg border p-2 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
                    <button
                      onClick={() => toggleSidebarGroup("insights")}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-semibold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}
                    >
                      <span className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" /> Insights
                      </span>
                      {sidebarGroups.insights ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    {sidebarGroups.insights && (
                      <div className="mt-2 space-y-1">
                        {navigationItems.slice(0, 1).map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => changeView(item.id as DashboardView)}
                              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${activeView === item.id ? (isDarkMode ? "bg-slate-100 text-slate-900" : "bg-slate-900 text-white") : (isDarkMode ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-white text-slate-700 hover:bg-slate-50")}`}
                            >
                              <Icon className="h-4 w-4" />
                              <span>
                                <span className="block font-medium">{item.label}</span>
                                <span className={`mt-0.5 block text-xs ${activeView === item.id ? (isDarkMode ? "text-slate-600" : "text-slate-300") : mutedTextClass}`}>{item.description}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className={`rounded-lg border p-2 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
                    <button
                      onClick={() => toggleSidebarGroup("management")}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-semibold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}
                    >
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4" /> Management
                      </span>
                      {sidebarGroups.management ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    {sidebarGroups.management && (
                      <div className="mt-2 space-y-1">
                        {navigationItems.slice(1).map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => changeView(item.id as DashboardView)}
                              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${activeView === item.id ? (isDarkMode ? "bg-slate-100 text-slate-900" : "bg-slate-900 text-white") : (isDarkMode ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-white text-slate-700 hover:bg-slate-50")}`}
                            >
                              <Icon className="h-4 w-4" />
                              <span>
                                <span className="block font-medium">{item.label}</span>
                                <span className={`mt-0.5 block text-xs ${activeView === item.id ? (isDarkMode ? "text-slate-600" : "text-slate-300") : mutedTextClass}`}>{item.description}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </aside>

            <div className="flex-1 space-y-6">
              {activeView === "overview" && (
                <section id="overview" className="space-y-6">
                  <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-sm">
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-300">Operations center</p>
                    <h1 className="mt-2 text-3xl font-bold">Admin dashboard</h1>
                    <p className="mt-2 max-w-2xl text-sm text-slate-300">
                      Monitor listings, dealer activity, and user permissions from one streamlined workspace.
                    </p>
                  </div>

                  <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${panelClass}`}>
                    <div className={`flex items-center gap-2 text-sm ${subtleTextClass}`}>
                      <BarChart3 className="h-4 w-4" /> Chart range
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["all", "30d", "7d"] as ChartRange[]).map((range) => (
                        <button
                          key={range}
                          onClick={() => setChartRange(range)}
                          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${chartRange === range ? (isDarkMode ? "bg-slate-100 text-slate-900" : "bg-slate-900 text-white") : (isDarkMode ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}`}
                        >
                          {range === "all" ? "All time" : range === "30d" ? "Last 30 days" : "Last 7 days"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Card className="p-4">
                      <p className="text-sm text-slate-500">Total listings</p>
                      <p className="mt-2 text-2xl font-semibold">{stats.totalListings}</p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-sm text-slate-500">Pending</p>
                      <p className="mt-2 text-2xl font-semibold">{stats.pendingApproval}</p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-sm text-slate-500">Dealers</p>
                      <p className="mt-2 text-2xl font-semibold">{stats.totalDealers}</p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-sm text-slate-500">Revenue</p>
                      <p className="mt-2 text-2xl font-semibold">KES {Number(stats.totalRevenue).toLocaleString()}</p>
                    </Card>
                  </div>

                  <Card className="p-6">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Email campaign scheduler</h2>
                        <p className={`text-sm ${mutedTextClass}`}>Schedule one-to-one or mass email campaigns for selected recipients.</p>
                      </div>
                      <div className={`rounded-full border px-3 py-1.5 text-sm ${pillClass}`}>{emailCampaignStatus || "Ready to schedule."}</div>
                    </div>

                    <div className="mb-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="emailUserSelect">Send to user</Label>
                        <select
                          id="emailUserSelect"
                          value={selectedEmailUser}
                          onChange={(e) => handleSelectEmailUser(e.target.value)}
                          className={`mt-2 w-full rounded-lg border px-3 py-2 ${inputClass}`}
                        >
                          <option value="">Choose a user</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.email}>{user.full_name || user.email}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="emailCampaignType">Campaign type</Label>
                        <select
                          id="emailCampaignType"
                          value={emailCampaignType}
                          onChange={(e) => setEmailCampaignType(e.target.value as "one-to-one" | "mass")}
                          className={`mt-2 w-full rounded-lg border px-3 py-2 ${inputClass}`}
                        >
                          <option value="mass">Mass email</option>
                          <option value="one-to-one">One-to-one</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="emailCampaignType">Campaign type</Label>
                        <select
                          id="emailCampaignType"
                          value={emailCampaignType}
                          onChange={(e) => setEmailCampaignType(e.target.value as "one-to-one" | "mass")}
                          className={`mt-2 w-full rounded-lg border px-3 py-2 ${inputClass}`}
                        >
                          <option value="mass">Mass email</option>
                          <option value="one-to-one">One-to-one</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="emailCampaignSubject">Subject</Label>
                        <Input
                          id="emailCampaignSubject"
                          value={emailCampaignSubject}
                          onChange={(e) => setEmailCampaignSubject(e.target.value)}
                          placeholder="Campaign subject"
                          className={`mt-2 ${inputClass}`}
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <Label htmlFor="emailCampaignBody">Message</Label>
                      <Textarea
                        id="emailCampaignBody"
                        value={emailCampaignBody}
                        onChange={(e) => setEmailCampaignBody(e.target.value)}
                        placeholder="Write your campaign message here..."
                        className={`mt-2 min-h-[140px] ${inputClass}`}
                      />
                    </div>

                    <div className="mt-4">
                      <Label htmlFor="emailCampaignRecipients">Recipients</Label>
                      <Textarea
                        id="emailCampaignRecipients"
                        value={emailCampaignRecipients}
                        onChange={(e) => setEmailCampaignRecipients(e.target.value)}
                        placeholder="Enter emails separated by commas, semicolons or new lines."
                        className={`mt-2 min-h-[140px] ${inputClass}`}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button onClick={handleRunEmailCampaign}>{emailCampaignType === "mass" ? "Schedule mass campaign" : "Schedule one-to-one campaign"}</Button>
                      <span className={`text-sm ${mutedTextClass}`}>Emails are sent in batches of 10 every 5 minutes.</span>
                    </div>
                  </Card>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card className="p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold">Listings by status</h2>
                          <p className={`text-sm ${mutedTextClass}`}>Activity for the selected time range.</p>
                        </div>
                      </div>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={listingStatusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={3}>
                              {listingStatusData.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card className="p-6">
                      <div className="mb-4">
                        <h2 className="text-lg font-semibold">User roles</h2>
                        <p className={`text-sm ${mutedTextClass}`}>Distribution of account roles across the platform.</p>
                      </div>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={userRoleData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={3}>
                              {userRoleData.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>
                </section>
              )}

              {activeView === "inventory" && (
                <section id="inventory" className="space-y-6">
                  <Card className="p-6">
                    <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
                      <CarIcon /> {editId ? "Edit Car" : "Add New Car"}
                    </h2>

                    <CarForm
                      form={form}
                      setForm={setForm}
                      loading={loading}
                      editMode={!!editId}
                      galleryPreview={galleryPreview}
                      setGalleryFiles={selectGalleryFiles}
                      galleryProgress={galleryProgress}
                      locationQuery={locationQuery}
                      setLocationQuery={setLocationQuery}
                      suggestions={suggestions}
                      onSelectSuggestion={(place: any) => {
                        setForm({ ...form, location: place.formatted });
                        setLocationQuery(place.formatted);
                      }}
                      dealerOptions={dealers.map((dealer) => ({ id: dealer.id, full_name: dealer.full_name, company_name: dealer.company_name, email: dealer.email }))}
                      selectedDealerId={form.dealer_id ?? null}
                      onDealerChange={(dealerId) => setForm({ ...form, dealer_id: dealerId })}
                      onSubmit={handleCarSubmit}
                      onCancelEdit={() => {
                        resetForm();
                        resetUploads();
                      }}
                    />
                  </Card>

                  <Card className={`${panelClass} p-6`}>
                    <div className={`sticky top-0 z-10 mb-4 flex flex-col gap-3 rounded-xl border p-3 backdrop-blur md:flex-row md:items-center md:justify-between ${isDarkMode ? "border-slate-700 bg-slate-900/90" : "border-slate-200 bg-white/90"}`}>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold">Cars</h2>
                        <span className={`rounded-full border px-2.5 py-1 text-xs ${pillClass}`}>{filteredCars.length} visible</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                          <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${mutedTextClass}`} />
                          <Input
                            value={carSearch}
                            onChange={(e) => setCarSearch(e.target.value)}
                            placeholder="Search cars"
                            className={`pl-9 ${inputClass}`}
                          />
                        </div>
                        <select
                          value={carStatusFilter}
                          onChange={(e) => setCarStatusFilter(e.target.value as "all" | "active" | "pending" | "removed")}
                          className={`rounded border px-3 py-2 ${inputClass}`}
                        >
                          <option value="all">All status</option>
                          <option value="active">Active</option>
                          <option value="pending">Pending</option>
                          <option value="removed">Removed</option>
                        </select>
                        <Button variant="outline" size="sm" onClick={() => exportRowsToCsv("cars.csv", filteredCars.map((car) => ({ make: car.make, model: car.model, year: car.year, price: car.price, status: car.status || "active", featured: car.featured ? "yes" : "no" })))}>
                          <Download className="mr-1 h-4 w-4" /> Export
                        </Button>
                      </div>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {(["all", "new", "pending", "featured"] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setCarQuickFilter(filter)}
                          className={`rounded-full border px-3 py-1.5 text-sm capitalize ${carQuickFilter === filter ? activeFilterClass : pillClass}`}
                        >
                          {filter === "all" ? "All" : filter}
                        </button>
                      ))}
                    </div>
                    <div className="mb-4 flex items-center justify-between">
                      <span className={`text-sm ${mutedTextClass}`}>Page {carsPage} of {totalCarPages}</span>
                      <span className={`text-sm ${mutedTextClass}`}>{filteredCars.length} matches</span>
                    </div>
                    <div className={`mb-4 flex flex-wrap gap-2 rounded-lg border px-3 py-2 text-sm ${pillClass}`}>
                      <button onClick={() => setCarSort((prev) => ({ key: "make", direction: prev.key === "make" && prev.direction === "asc" ? "desc" : "asc" }))} className="flex items-center gap-1">Make <ArrowUpDown className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setCarSort((prev) => ({ key: "price", direction: prev.key === "price" && prev.direction === "asc" ? "desc" : "asc" }))} className="flex items-center gap-1">Price <ArrowUpDown className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setCarSort((prev) => ({ key: "year", direction: prev.key === "year" && prev.direction === "asc" ? "desc" : "asc" }))} className="flex items-center gap-1">Year <ArrowUpDown className="h-3.5 w-3.5" /></button>
                    </div>
                    {filteredCars.length === 0 ? (
                      <p>No cars found.</p>
                    ) : (
                      <>
                        {pagedCars.map((car) => (
                          <div key={car.id} className={`mb-3 flex flex-col justify-between gap-3 rounded-lg border p-3 md:flex-row md:items-center ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                            <div className="flex items-center gap-4">
                              {Array.isArray(car.gallery) && car.gallery.length > 0 ? (
                                <img src={car.gallery[0]} alt={car.make} className="h-16 w-24 cursor-pointer rounded object-cover" onClick={() => openLightbox(car.gallery!)} />
                              ) : (
                                <div className="flex h-16 w-24 items-center justify-center rounded bg-gray-200 text-sm text-gray-500">No Image</div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">{car.make} {car.model} ({car.year})</h3>
                                  {car.status === "pending" && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">Pending</span>}
                                </div>
                                <p className="text-sm text-gray-500">{car.location}</p>
                                <p className="text-sm text-gray-600">KES {Number(car.price).toLocaleString()}</p>
                                {(() => {
                                  const dealer = dealers.find((item) => String(item.id) === String(car.dealer_id));
                                  return dealer ? (
                                    <p className="mt-1 text-sm text-slate-500">
                                      Dealer: {dealer.full_name}{dealer.company_name ? ` • ${dealer.company_name}` : ""}
                                    </p>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant={car.featured ? "secondary" : "outline"} onClick={() => handleToggleFeatured(car)}>
                                <Star className={`h-4 w-4 ${car.featured ? "text-yellow-500" : "text-gray-400"}`} />
                              </Button>
                              <Button size="sm" onClick={() => startEditCar(car)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteCar(car.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              {car.status === "pending" && (
                                <>
                                  <Button size="sm" className="bg-green-500" onClick={() => handleApproval(car.id, "active")}>
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleApproval(car.id, "removed")}>
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="mt-4 flex items-center justify-between">
                          <Button variant="outline" size="sm" onClick={() => setCarsPage((page) => Math.max(1, page - 1))} disabled={carsPage === 1}>
                            <ChevronLeft className="mr-1 h-4 w-4" /> Prev
                          </Button>
                          <span className={`text-sm ${mutedTextClass}`}>Showing {pagedCars.length} of {filteredCars.length}</span>
                          <Button variant="outline" size="sm" onClick={() => setCarsPage((page) => Math.min(totalCarPages, page + 1))} disabled={carsPage === totalCarPages}>
                            Next <ChevronRightIcon className="ml-1 h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </Card>
                </section>
              )}

              {activeView === "dealers" && (
                <section id="dealers">
                  <Card className="p-6">
                    <div className={`sticky top-0 z-10 mb-4 flex flex-col gap-3 rounded-xl border p-3 backdrop-blur md:flex-row md:items-center md:justify-between ${isDarkMode ? "border-slate-700 bg-slate-900/90" : "border-slate-200 bg-white/90"}`}>
                      <div className="flex items-center gap-2">
                        <h2 className="flex items-center gap-2 text-2xl font-bold">
                          <UserPlus /> Dealers
                        </h2>
                        <span className={`rounded-full border px-2.5 py-1 text-xs ${pillClass}`}>{filteredDealers.length} visible</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative w-full md:w-72">
                          <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${mutedTextClass}`} />
                          <Input
                            value={dealerSearch}
                            onChange={(e) => setDealerSearch(e.target.value)}
                            placeholder="Search dealers"
                            className={`pl-9 ${inputClass}`}
                          />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => exportRowsToCsv("dealers.csv", filteredDealers.map((dealer) => ({ full_name: dealer.full_name, email: dealer.email, company_name: dealer.company_name || "" })))}>
                          <Download className="mr-1 h-4 w-4" /> Export
                        </Button>
                      </div>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {(["all", "new"] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setDealerQuickFilter(filter)}
                          className={`rounded-full border px-3 py-1.5 text-sm capitalize ${dealerQuickFilter === filter ? activeFilterClass : pillClass}`}
                        >
                          {filter === "all" ? "All" : filter}
                        </button>
                      ))}
                    </div>
                    <div className="mb-4 flex items-center justify-between">
                      <span className={`text-sm ${mutedTextClass}`}>Page {dealersPage} of {totalDealerPages}</span>
                      <span className={`text-sm ${mutedTextClass}`}>{filteredDealers.length} matches</span>
                    </div>
                    <div className={`mb-4 flex flex-wrap gap-2 rounded-lg border px-3 py-2 text-sm ${pillClass}`}>
                      <button onClick={() => setDealerSort((prev) => ({ key: "full_name", direction: prev.key === "full_name" && prev.direction === "asc" ? "desc" : "asc" }))} className="flex items-center gap-1">Name <ArrowUpDown className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setDealerSort((prev) => ({ key: "created_at", direction: prev.key === "created_at" && prev.direction === "asc" ? "desc" : "asc" }))} className="flex items-center gap-1">Joined <ArrowUpDown className="h-3.5 w-3.5" /></button>
                    </div>

                    <DealerForm onCreate={handleCreateDealer} />

                    <div className="mt-6 space-y-3">
                      {filteredDealers.length === 0 ? (
                        <p>No dealers found.</p>
                      ) : (
                        <>
                          {pagedDealers.map((d) => (
                            <div key={d.id} className={`flex flex-col justify-between gap-3 rounded-lg border p-3 md:flex-row md:items-center ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                              <div className="flex items-center gap-3">
                                {d.company_logo ? (
                                  <img src={d.company_logo} alt="logo" className="h-10 w-10 rounded object-cover" />
                                ) : (
                                  <div className="h-10 w-10 rounded bg-gray-200" />
                                )}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold">{d.full_name}</p>
                                    {d.created_at && new Date(d.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000 && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">New</span>}
                                  </div>
                                  <p className="text-sm text-gray-500">{d.email}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleCreateForDealer(d)}>
                                  <CarIcon className="mr-1 h-4 w-4" /> Create for dealer
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteDealer(d.id)}>
                                  <UserX className="mr-1 h-4 w-4" /> Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                          <div className="mt-4 flex items-center justify-between">
                            <Button variant="outline" size="sm" onClick={() => setDealersPage((page) => Math.max(1, page - 1))} disabled={dealersPage === 1}>
                              <ChevronLeft className="mr-1 h-4 w-4" /> Prev
                            </Button>
                            <span className={`text-sm ${mutedTextClass}`}>Showing {pagedDealers.length} of {filteredDealers.length}</span>
                            <Button variant="outline" size="sm" onClick={() => setDealersPage((page) => Math.min(totalDealerPages, page + 1))} disabled={dealersPage === totalDealerPages}>
                              Next <ChevronRightIcon className="ml-1 h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                </section>
              )}

              {activeView === "users" && (
                <section id="users">
                  <Card className={`${panelClass} p-6`}>
                    <div className={`sticky top-0 z-10 mb-4 flex flex-col gap-3 rounded-xl border p-3 backdrop-blur md:flex-row md:items-center md:justify-between ${isDarkMode ? "border-slate-700 bg-slate-900/90" : "border-slate-200 bg-white/90"}`}>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold">Users</h2>
                        <span className={`rounded-full border px-2.5 py-1 text-xs ${pillClass}`}>{filteredUsers.length} visible</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                          <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${mutedTextClass}`} />
                          <Input
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            placeholder="Search users"
                            className={`pl-9 ${inputClass}`}
                          />
                        </div>
                        <select
                          value={userRoleFilter}
                          onChange={(e) => setUserRoleFilter(e.target.value as "all" | "admin" | "dealer" | "salesperson" | "user")}
                          className={`rounded border px-3 py-2 ${inputClass}`}
                        >
                          <option value="all">All roles</option>
                          <option value="admin">Admin</option>
                          <option value="dealer">Dealer</option>
                          <option value="salesperson">Salesperson</option>
                          <option value="user">User</option>
                        </select>
                        <Button variant="outline" size="sm" onClick={() => exportRowsToCsv("users.csv", filteredUsers.map((userItem) => ({ full_name: userItem.full_name || userItem.email, email: userItem.email, role: userItem.role || "user" })))}>
                          <Download className="mr-1 h-4 w-4" /> Export
                        </Button>
                      </div>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {(["all", "new"] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setUserQuickFilter(filter)}
                          className={`rounded-full border px-3 py-1.5 text-sm capitalize ${userQuickFilter === filter ? activeFilterClass : pillClass}`}
                        >
                          {filter === "all" ? "All" : filter}
                        </button>
                      ))}
                    </div>
                    <div className="mb-4 flex items-center justify-between">
                      <span className={`text-sm ${mutedTextClass}`}>Page {usersPage} of {totalUserPages}</span>
                      <span className={`text-sm ${mutedTextClass}`}>{filteredUsers.length} matches</span>
                    </div>
                    <div className={`mb-4 flex flex-wrap gap-2 rounded-lg border px-3 py-2 text-sm ${pillClass}`}>
                      <button onClick={() => setUserSort((prev) => ({ key: "full_name", direction: prev.key === "full_name" && prev.direction === "asc" ? "desc" : "asc" }))} className="flex items-center gap-1">Name <ArrowUpDown className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setUserSort((prev) => ({ key: "role", direction: prev.key === "role" && prev.direction === "asc" ? "desc" : "asc" }))} className="flex items-center gap-1">Role <ArrowUpDown className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setUserSort((prev) => ({ key: "created_at", direction: prev.key === "created_at" && prev.direction === "asc" ? "desc" : "asc" }))} className="flex items-center gap-1">Joined <ArrowUpDown className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="space-y-3">
                      {filteredUsers.length === 0 ? (
                        <p>No users found.</p>
                      ) : (
                        <>
                          {pagedUsers.map((userItem) => (
                            <div key={userItem.id} className={`flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white"}`}>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold">{userItem.full_name || userItem.email}</p>
                                  {userItem.created_at && new Date(userItem.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000 && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">New</span>}
                                </div>
                                <p className="text-sm text-gray-500">{userItem.email}</p>
                              </div>
                              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                <select
                                  defaultValue={userItem.role || "user"}
                                  className="rounded border px-3 py-2"
                                  onChange={(e) => handleUpdateUser(userItem.id, e.target.value, Number(userItem.commission_rate || 15))}
                                >
                                  <option value="user">User</option>
                                  <option value="dealer">Dealer</option>
                                  <option value="salesperson">Salesperson</option>
                                  <option value="admin">Admin</option>
                                </select>
                                <Input
                                  type="number"
                                  defaultValue={userItem.commission_rate || 15}
                                  className="w-28"
                                  onBlur={(e) => handleUpdateUser(userItem.id, userItem.role || "user", Number(e.target.value || 15))}
                                />
                                <Button size="sm" disabled={savingUser === userItem.id} onClick={() => handleUpdateUser(userItem.id, userItem.role || "user", Number(userItem.commission_rate || 15))}>
                                  {savingUser === userItem.id ? "Saving..." : "Save"}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => handleSelectEmailUser(userItem.email)}>
                                  Message user
                                </Button>
                              </div>
                            </div>
                          ))}
                          <div className="mt-4 flex items-center justify-between">
                            <Button variant="outline" size="sm" onClick={() => setUsersPage((page) => Math.max(1, page - 1))} disabled={usersPage === 1}>
                              <ChevronLeft className="mr-1 h-4 w-4" /> Prev
                            </Button>
                            <span className={`text-sm ${mutedTextClass}`}>Showing {pagedUsers.length} of {filteredUsers.length}</span>
                            <Button variant="outline" size="sm" onClick={() => setUsersPage((page) => Math.min(totalUserPages, page + 1))} disabled={usersPage === totalUserPages}>
                              Next <ChevronRightIcon className="ml-1 h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)}>
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="relative max-w-4xl w-full p-4">
            {lightboxImages[currentIndex] && (
              <img src={lightboxImages[currentIndex]} alt="Gallery" className="w-full rounded-lg" />
            )}
            <button className="absolute top-4 right-4 bg-white rounded-full px-3 py-2" onClick={() => setLightboxOpen(false)}>✕</button>
            {lightboxImages.length > 1 && (
              <>
                <button className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full px-3 py-2" onClick={prevImage}>‹</button>
                <button className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full px-3 py-2" onClick={nextImage}>›</button>
              </>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
