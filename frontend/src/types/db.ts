// ✅ JSON type utility
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ✅ Database Schema Types
export type Database = {
  public: {
    Tables: {
      // 🚗 Cars Table
      cars: {
        Row: {
          id: number;
          make: string;
          model: string;
          year: number;
          price: number;
          mileage: number;
          location: string;
          phone: string | null; // ✅ Added
          image: string | null;
          description: string | null;
          condition: string;
          transmission: string | null;
          featured: boolean;
          dealer_id: number | null;
          status: "pending" | "active" | "removed" | "archived";
          created_at: string | null;
          gallery: string[] | null;
          video_url: string | null;
        };
        Insert: {
          make: string;
          model: string;
          year: number;
          price: number;
          mileage: number;
          location: string;
          phone?: string | null; // ✅ Added
          image?: string | null;
          description?: string | null;
          condition: string;
          transmission?: string | null;
          featured: boolean;
          dealer_id?: number | null;
          status: "pending" | "active" | "removed" | "archived";
          created_at?: string | null;
          gallery?: string[] | null;
          video_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["cars"]["Row"]>;
      };

      // 🏢 Dealers Table
      dealers: {
        Row: {
          id: number;
          name: string;
          location: string;
          phone: string;
          image: string | null;
          verified: boolean;
          rating: number | null;
          reviews: number | null;
          listings: number | null;
          created_at: string | null;
          images: string[] | null;
          video: string | null;
        };
        Insert: {
          name: string;
          location: string;
          phone: string;
          image?: string | null;
          verified: boolean;
          rating?: number | null;
          reviews?: number | null;
          listings?: number | null;
          created_at?: string | null;
          images?: string[] | null;
          video?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["dealers"]["Row"]>;
      };

      // 💬 Messages Table
      messages: {
        Row: {
          id: number;
          name: string;
          email: string;
          phone: string | null;
          subject: string;
          message: string;
          created_at: string | null;
        };
        Insert: {
          name: string;
          email: string;
          phone?: string | null;
          subject: string;
          message: string;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
      };
    };

    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};