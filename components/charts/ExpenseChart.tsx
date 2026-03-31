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

export interface ExpenseChartPoint {
  month: MonthKey;
  expensesTotal: number;
}

export function ExpenseChart({ data }: { data: ExpenseChartPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="expensesTotal" stroke="#dc2626" strokeWidth={2} name="Expenses" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

