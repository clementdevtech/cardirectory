import { toast } from "react-toastify";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

export async function apiRequest(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    // ✅ Auto toast notifications
    if (res.ok && data.message) toast.success(data.message);
    if (!res.ok) {
      const msg = data.error || "Something went wrong.";
      toast.error(msg);
    }

    return data;
  } catch (err) {
    console.error("API error:", err);
    toast.error("Network error. Please try again.");
    throw err;
  }
}
