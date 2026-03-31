"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectSummary, MonthKey } from "@/types/finance";

export interface DashboardSeriesPoint {
  month: MonthKey;
  revenueTotal: number;
  expensesTotal: number;
  marginPct: number;
  travelExpenses: number;
  surveysCount: number;
  travelCostPerSurvey: number;
}

export interface DashboardData {
  orgId: string;
  months: number;
  metrics: {
    revenueTotal: number;
    expensesTotal: number;
    netProfit: number;
    marginPct: number;
  };
  projects: ProjectSummary[];
  series: DashboardSeriesPoint[];
}

export function useDashboardData(orgId: string | null | undefined, months: number) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stableOrgId = useMemo(() => orgId ?? null, [orgId]);

  useEffect(() => {
    if (!stableOrgId) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dashboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId: stableOrgId, months }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        const json = (await res.json()) as DashboardData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dashboard data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [stableOrgId, months]);

  return { data, loading, error };
}

