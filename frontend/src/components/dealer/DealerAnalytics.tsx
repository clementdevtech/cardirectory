import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";

interface CarViews {
  make: string;
  model: string;
  year: number;
  views: number;
}

const DealerAnalytics = () => {
  const [data, setData] = useState<CarViews[]>([]);

  useEffect(() => {
    const fetchViews = async () => {
      const { data } = await supabase.rpc("dealer_car_views");
      setData(data ?? []);
    };

    fetchViews();
  }, []);

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">📊 Views per Car</h2>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No views yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <XAxis
              dataKey={(d) => `${d.make} ${d.model}`}
              tick={{ fontSize: 12 }}
            />
            <YAxis />
            <Tooltip />
            <Bar dataKey="views" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
};

export default DealerAnalytics;
