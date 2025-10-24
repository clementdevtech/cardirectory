import { toast } from "react-toastify";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL;

/**
 * A safe, typed wrapper for backend fetch requests.
 * Automatically shows toast messages for success/error.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      credentials: "include",
    });

    const data: T = (await res.json().catch(() => ({}))) as T;

    if (res.ok) {
      const msg = (data as { message?: string }).message;
      if (msg) toast.success(msg);
      return data;
    } else {
      const msg =
        (data as { error?: string }).error || "Something went wrong.";
      toast.error(msg);
      throw new Error(msg);
    }
  } catch (err) {
    console.error("❌ API request error:", err);
    toast.error("Network error. Please try again.");
    throw err;
  }
}
