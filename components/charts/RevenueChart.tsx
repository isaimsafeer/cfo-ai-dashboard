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

export interface RevenueChartPoint {
  month: MonthKey;
  revenueTotal: number;
}

export function RevenueChart({ data }: { data: RevenueChartPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="revenueTotal" stroke="#2563eb" strokeWidth={2} name="Revenue" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

