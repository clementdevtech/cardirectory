import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DealerViewsOverTime() {
  const [data, setData] = useState<any[]>([]);
  const [mode, setMode] = useState<"daily" | "monthly">("daily");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc(
        mode === "daily" ? "dealer_views_daily" : "dealer_views_monthly"
      );
      setData(data ?? []);
    };

    load();
  }, [mode]);

  return (
    <Card className="p-6 mt-6">
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold">📈 Views Over Time</h3>
        <div className="space-x-2">
          <Button size="sm" onClick={() => setMode("daily")}>Daily</Button>
          <Button size="sm" variant="outline" onClick={() => setMode("monthly")}>
            Monthly
          </Button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis dataKey={mode === "daily" ? "day" : "month"} />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="views" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
