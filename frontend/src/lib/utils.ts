import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function facebookShareUrl(url: string, quote?: string) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}${quote ? `&quote=${encodeURIComponent(quote)}` : ""}`;
}

export function whatsappShareUrl(message: string, url?: string) {
  const text = url ? `${message} ${url}` : message;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function fetchImageFile(imageUrl: string): Promise<File | null> {
  try {
    const response = await fetch(imageUrl, { mode: "cors" });
    const blob = await response.blob();
    return new File([blob], "car-image.jpg", { type: blob.type || "image/jpeg" });
  } catch {
    return null;
  }
}

export async function shareViaWebShare(options: {
  title: string;
  text: string;
  url: string;
  imageUrl: string;
  file?: File;
}) {
  if (!navigator.share) {
    throw new Error("Web Share API not available");
  }

  const shareData: ShareData = {
    title: options.title,
    text: options.text,
    url: options.url,
  };

  if (options.file && navigator.canShare?.({ files: [options.file] })) {
    (shareData as ShareData & { files: File[] }).files = [options.file];
  }

  return navigator.share(shareData);
}

export async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const result = document.execCommand("copy");
    return result;
  } finally {
    document.body.removeChild(textarea);
  }
}

export function normalizeWhatsappNumber(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("254")) return digits;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

export function buildWhatsappUrl(phone?: string | null, text?: string): string | undefined {
  const normalized = normalizeWhatsappNumber(phone);
  if (!normalized) return undefined;
  return `https://wa.me/${normalized}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
