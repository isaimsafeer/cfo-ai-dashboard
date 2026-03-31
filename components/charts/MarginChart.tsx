"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthKey } from "@/types/finance";

export interface MarginChartPoint {
  month: MonthKey;
  marginPct: number;
}

export function MarginChart({ data }: { data: MarginChartPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="marginPct"
            stroke="#16a34a"
            strokeWidth={2}
            name="Margin %"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

