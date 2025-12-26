import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DealerNotification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const useDealerNotifications = () => {
  const [notifications, setNotifications] = useState<DealerNotification[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("dealer_notifications")
        .select("*")
        .order("created_at", { ascending: false });

      setNotifications(data ?? []);
    };

    load();
  }, []);

  return notifications;
};
