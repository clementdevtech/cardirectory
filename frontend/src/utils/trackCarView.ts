import { supabase } from "@/integrations/supabase/client";

export const trackCarView = async (carId: number) => {
  try {
    await supabase.from("car_views").insert({
      car_id: carId,
    });
  } catch (e) {
    // silently fail – views should never break UX
    console.error("Failed to track view", e);
  }
};
