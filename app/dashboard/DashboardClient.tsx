"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDashboardOrganizations } from "@/hooks/useDashboardOrganizations";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthKey, ProjectSummary } from "@/types/finance";
import { buildAiChatHref } from "@/types/navigation";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatCurrencyCompact(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(n);
}

function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

function parseMonthKey(month: MonthKey): Date | null {
  // Expected shape: "YYYY-MM"
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIdx)) return null;
  return new Date(Date.UTC(year, monthIdx, 1));
}

function formatMonthLabel(month: MonthKey): string {
  const d = parseMonthKey(month);
  if (!d) return month;
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit", timeZone: "UTC" }).format(d);
}

function calcTrendPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  // Use previous magnitude so the sign is stable even if previous is negative (e.g. net profit).
  return ((current - previous) / Math.abs(previous)) * 100;
}

function trendDirection(current: number, previous: number): "up" | "down" | "flat" {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}

function TrendPill({
  current,
  previous,
  formatter,
  accent,
  ariaLabel,
}: {
  current: number;
  previous: number;
  formatter: (n: number) => string;
  accent: "emerald" | "amber" | "blue" | "violet";
  ariaLabel: string;
}) {
  const direction = trendDirection(current, previous);
  const trendPct = calcTrendPct(current, previous);
  if (trendPct === null) {
    return (
      <div
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300"
      >
        <span className="opacity-80">—</span>
      </div>
    );
  }

  const isUp = direction === "up";
  const isDown = direction === "down";
  const sign = trendPct >= 0 ? "+" : "";
  const val = `${sign}${Math.abs(trendPct).toFixed(1)}%`;

  const accentClasses: Record<typeof accent, { pill: string; text: string; dot: string }> = {
    emerald: {
      pill: "bg-emerald-500/10 border-emerald-400/20",
      text: "text-emerald-200",
      dot: "bg-emerald-400",
    },
    amber: {
      pill: "bg-amber-500/10 border-amber-400/20",
      text: "text-amber-200",
      dot: "bg-amber-400",
    },
    blue: { pill: "bg-blue-500/10 border-blue-400/20", text: "text-blue-200", dot: "bg-blue-400" },
    violet: { pill: "bg-violet-500/10 border-violet-400/20", text: "text-violet-200", dot: "bg-violet-400" },
  };

  const chosen = accentClasses[accent];
  const arrow = isUp ? "↑" : isDown ? "↓" : "→";

  return (
    <div
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors ${chosen.pill}`}
      title={`${ariaLabel}: ${formatter(current)} vs ${formatter(previous)}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${chosen.dot} ${direction === "flat" ? "opacity-60" : ""}`}
      />
      <span className={chosen.text}>
        {arrow} {val}
      </span>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  accent,
  valueFormatter,
}: {
  active?: boolean;
  payload?: readonly any[];
  label?: string | number;
  accent: "cyan" | "coral" | "emerald";
  valueFormatter: (v: unknown) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const colorByAccent: Record<typeof accent, string> = {
    cyan: "rgba(34,211,238,0.95)",
    coral: "rgba(248,113,113,0.95)",
    emerald: "rgba(52,211,153,0.95)",
  };

  const accentColor = colorByAccent[accent];
  const value = payload[0]?.value;
  const name = payload[0]?.name ?? "Value";

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 shadow-lg backdrop-blur">
      <div className="text-xs text-zinc-400">{label ? formatMonthLabel(label as MonthKey) : ""}</div>
      <div className="mt-1 flex items-center justify-between gap-4">
        <div className="text-sm font-semibold text-zinc-100">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
            {name}
          </span>
        </div>
        <div className="text-sm font-semibold text-zinc-50">{valueFormatter(value)}</div>
      </div>
    </div>
  );
}

function PremiumChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/7">
      <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-white/10 to-transparent blur-2xl opacity-70 transition-opacity group-hover:opacity-100" />
      <div className="relative">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-zinc-100">{title}</div>
            {subtitle ? <div className="mt-1 text-xs text-zinc-400">{subtitle}</div> : null}
          </div>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export default function DashboardClient() {
  const { organizations, loading: orgsLoading, error: orgsError } = useDashboardOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [months, setMonths] = useState(12);
  const router = useRouter();

  const activeOrgId = selectedOrgId ?? organizations[0]?.id ?? null;

  useEffect(() => {
    if (!selectedOrgId && organizations.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  const { data, loading: dataLoading, error: dataError } = useDashboardData(selectedOrgId, months);

  const revenueChartData = useMemo(() => {
    if (!data) return [];
    return data.series.map((p) => ({ month: p.month, revenueTotal: p.revenueTotal }));
  }, [data]);

  const expenseChartData = useMemo(() => {
    if (!data) return [];
    return data.series.map((p) => ({ month: p.month, expensesTotal: p.expensesTotal }));
  }, [data]);

  const marginChartData = useMemo(() => {
    if (!data) return [];
    return data.series.map((p) => ({ month: p.month, marginPct: p.marginPct }));
  }, [data]);

  const metricCards = useMemo(() => {
    if (!data) return null;
    const { metrics, series } = data;
    const prev = series.at(-2);
    const last = series.at(-1);

    const prevRev = prev?.revenueTotal ?? 0;
    const lastRev = last?.revenueTotal ?? metrics.revenueTotal;
    const prevExp = prev?.expensesTotal ?? 0;
    const lastExp = last?.expensesTotal ?? metrics.expensesTotal;

    const prevProfit = (prev?.revenueTotal ?? 0) - (prev?.expensesTotal ?? 0);
    const lastProfit = (last?.revenueTotal ?? 0) - (last?.expensesTotal ?? 0);
    const prevMargin = prev?.marginPct ?? 0;
    const lastMargin = last?.marginPct ?? metrics.marginPct;

    const CardIcon = ({ variant }: { variant: "revenue" | "expenses" | "profit" | "margin" }) => {
      const common = "h-5 w-5";
      if (variant === "revenue") {
        return (
          <svg viewBox="0 0 24 24" className={common} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
              stroke="rgba(52,211,153,0.95)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M12 7a5 5 0 100 10 5 5 0 000-10z"
              stroke="rgba(34,211,238,0.95)"
              strokeWidth="1.6"
            />
          </svg>
        );
      }
      if (variant === "expenses") {
        return (
          <svg viewBox="0 0 24 24" className={common} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 3l9 4.5-9 4.5-9-4.5L12 3z"
              stroke="rgba(251,191,36,0.95)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M3 12l9 4.5 9-4.5"
              stroke="rgba(245,158,11,0.95)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M3 16.5l9 4.5 9-4.5"
              stroke="rgba(245,158,11,0.75)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        );
      }
      if (variant === "profit") {
        return (
          <svg viewBox="0 0 24 24" className={common} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4 19a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v11z"
              stroke="rgba(96,165,250,0.95)"
              strokeWidth="1.6"
            />
            <path
              d="M8 13l2 2 6-7"
              stroke="rgba(37,99,235,0.95)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z"
            stroke="rgba(167,139,250,0.95)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    };

    const MetricCard = ({
      label,
      value,
      accent,
      iconVariant,
      trend,
    }: {
      label: string;
      value: string;
      accent: "emerald" | "amber" | "blue" | "violet";
      iconVariant: "revenue" | "expenses" | "profit" | "margin";
      trend: { current: number; previous: number; formatter: (n: number) => string; ariaLabel: string };
    }) => {
      const accentBg =
        accent === "emerald"
          ? "from-emerald-500/25 to-transparent"
          : accent === "amber"
            ? "from-amber-500/25 to-transparent"
            : accent === "blue"
              ? "from-blue-500/25 to-transparent"
              : "from-violet-500/25 to-transparent";

      return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/7">
          <div
            className={`absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${accentBg} blur-2xl opacity-80`}
          />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <span className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2">
                    <CardIcon variant={iconVariant} />
                  </span>
                  {label}
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">{value}</div>
                <div className="mt-2">
                  <TrendPill
                    current={trend.current}
                    previous={trend.previous}
                    formatter={trend.formatter}
                    accent={accent}
                    ariaLabel={trend.ariaLabel}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Revenue"
          value={formatCurrencyCompact(metrics.revenueTotal)}
          accent="emerald"
          iconVariant="revenue"
          trend={{
            current: lastRev,
            previous: prevRev,
            formatter: (n) => formatCurrencyCompact(n),
            ariaLabel: "Revenue trend",
          }}
        />
        <MetricCard
          label="Total Expenses"
          value={formatCurrencyCompact(metrics.expensesTotal)}
          accent="amber"
          iconVariant="expenses"
          trend={{
            current: lastExp,
            previous: prevExp,
            formatter: (n) => formatCurrencyCompact(n),
            ariaLabel: "Expenses trend",
          }}
        />
        <MetricCard
          label="Net Profit"
          value={formatCurrencyCompact(metrics.netProfit)}
          accent="blue"
          iconVariant="profit"
          trend={{
            current: lastProfit,
            previous: prevProfit,
            formatter: (n) => formatCurrencyCompact(n),
            ariaLabel: "Profit trend",
          }}
        />
        <MetricCard
          label="Margin %"
          value={formatPercent(metrics.marginPct)}
          accent="violet"
          iconVariant="margin"
          trend={{
            current: lastMargin,
            previous: prevMargin,
            formatter: (n) => formatPercent(n),
            ariaLabel: "Margin trend",
          }}
        />
      </div>
    );
  }, [data]);

  const projectTable = useMemo(() => {
    if (!data) return null;
    const projects: ProjectSummary[] = data.projects;
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 shadow-sm backdrop-blur">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5">
              <tr className="border-b border-white/10">
                <th className="px-5 py-3 font-semibold text-zinc-300">Project</th>
                <th className="px-5 py-3 font-semibold text-zinc-300">Revenue</th>
                <th className="px-5 py-3 font-semibold text-zinc-300">Expenses</th>
                <th className="px-5 py-3 font-semibold text-zinc-300">Net Profit</th>
                <th className="px-5 py-3 font-semibold text-zinc-300">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {projects
                .slice()
                .sort((a, b) => b.netProfit - a.netProfit)
                .map((p) => (
                  <tr
                    key={p.projectId}
                    className="border-b border-white/5 last:border-b-0 odd:bg-white/[0.02] even:bg-transparent transition-colors hover:bg-white/[0.05]"
                  >
                    <td className="px-5 py-3 font-semibold text-zinc-100">
                      <div className="flex items-center justify-between gap-4">
                        <span className="truncate">{p.projectName}</span>
                        {p.marginPct >= 20 ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                            Strong
                          </span>
                        ) : p.marginPct >= 5 ? (
                          <span className="inline-flex items-center rounded-full border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-200">
                            Stable
                          </span>
                        ) : p.marginPct >= 0 ? (
                          <span className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-200">
                            Watch
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-rose-400/25 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-200">
                            Loss
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-zinc-200">{formatCurrencyCompact(p.revenueTotal)}</td>
                    <td className="px-5 py-3 text-zinc-200">{formatCurrencyCompact(p.expensesTotal)}</td>
                    <td className={`px-5 py-3 font-semibold ${p.netProfit >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                      {formatCurrencyCompact(p.netProfit)}
                    </td>
                    <td className="px-5 py-3 text-zinc-200">{formatPercent(p.marginPct)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }, [data]);

  return (
    <div className="min-h-screen w-full bg-[#07090c] text-zinc-100 font-sans">
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.16),_transparent_55%),radial-gradient(ellipse_at_right,_rgba(59,130,246,0.14),_transparent_48%),radial-gradient(ellipse_at_left,_rgba(168,85,247,0.12),_transparent_42%)]" />

        <div className="relative mx-auto w-full max-w-6xl p-6 pb-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                <span className="bg-gradient-to-r from-cyan-300 via-emerald-300 to-indigo-300 bg-clip-text text-transparent">
                  AI CFO Dashboard
                </span>
              </h1>
              <div className="mt-2 text-sm text-zinc-400">
                Production metrics sourced from Supabase (rolling window).
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                  Real-time analytics
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                  Secure org scoping
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Organization</label>
                <div className="relative">
                  <select
                    aria-label="Organization"
                    className="w-full appearance-none rounded-full border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-zinc-100 backdrop-blur outline-none transition-colors focus:border-white/20 focus:bg-white/10 focus:ring-1 focus:ring-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                    value={selectedOrgId ?? ""}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    disabled={orgsLoading}
                  >
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M7 10l5 5 5-5"
                        stroke="rgba(255,255,255,0.72)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Months</label>
                <div className="relative">
                  <select
                    aria-label="Months"
                    className="w-full appearance-none rounded-full border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-zinc-100 backdrop-blur outline-none transition-colors focus:border-white/20 focus:bg-white/10 focus:ring-1 focus:ring-white/15"
                    value={months}
                    onChange={(e) => setMonths(Number(e.target.value))}
                  >
                    {[6, 12, 24].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M7 10l5 5 5-5"
                        stroke="rgba(255,255,255,0.72)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push(buildAiChatHref({ orgId: activeOrgId ?? undefined }))}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:bg-white/10 hover:border-white/15 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={!activeOrgId && orgsLoading}
                aria-label="Open chat with AI CFO"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
                Chat with AI
              </button>
            </div>
          </div>

          {orgsError ? (
            <div className="mt-6 text-sm text-rose-400" role="alert">
              {orgsError}
            </div>
          ) : null}

          {dataLoading ? (
            <div className="mt-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="text-sm text-zinc-300">Loading dashboard data…</div>
                <div className="mt-3 h-2 w-56 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-cyan-300/70 to-emerald-300/70" />
                </div>
              </div>
            </div>
          ) : data ? (
            <div className="mt-6">
              {metricCards}

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1">
                  <PremiumChartPanel title="Revenue Trend" subtitle={`Last ${months} months`}>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueChartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(34,211,238,0.35)" />
                              <stop offset="60%" stopColor="rgba(37,99,235,0.12)" />
                              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                            </linearGradient>
                          </defs>

                          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }}
                            tickFormatter={(v) => formatMonthLabel(v as MonthKey)}
                            minTickGap={30}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }}
                            tickFormatter={(v) => {
                              const n = typeof v === "number" ? v : Number(v);
                              return Number.isFinite(n) ? formatCurrencyCompact(n) : "";
                            }}
                          />
                          <Tooltip
                            cursor={{ stroke: "rgba(34,211,238,0.35)", strokeWidth: 2 }}
                            content={(props) => (
                              <ChartTooltip accent="cyan" valueFormatter={(v) => formatCurrency(Number(v))} {...props} />
                            )}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenueTotal"
                            name="Revenue"
                            stroke="rgba(34,211,238,0.95)"
                            strokeWidth={2.2}
                            fill="url(#revenueFill)"
                            fillOpacity={1}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 2, stroke: "rgba(34,211,238,0.95)", fill: "#07090c" }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </PremiumChartPanel>
                </div>

                <div className="lg:col-span-1">
                  <PremiumChartPanel title="Expense Trend" subtitle={`Last ${months} months`}>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={expenseChartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(248,113,113,0.30)" />
                              <stop offset="60%" stopColor="rgba(239,68,68,0.10)" />
                              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                            </linearGradient>
                          </defs>

                          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }}
                            tickFormatter={(v) => formatMonthLabel(v as MonthKey)}
                            minTickGap={30}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }}
                            tickFormatter={(v) => {
                              const n = typeof v === "number" ? v : Number(v);
                              return Number.isFinite(n) ? formatCurrencyCompact(n) : "";
                            }}
                          />
                          <Tooltip
                            cursor={{ stroke: "rgba(248,113,113,0.35)", strokeWidth: 2 }}
                            content={(props) => (
                              <ChartTooltip accent="coral" valueFormatter={(v) => formatCurrency(Number(v))} {...props} />
                            )}
                          />
                          <Area
                            type="monotone"
                            dataKey="expensesTotal"
                            name="Expenses"
                            stroke="rgba(248,113,113,0.95)"
                            strokeWidth={2.2}
                            fill="url(#expenseFill)"
                            fillOpacity={1}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 2, stroke: "rgba(248,113,113,0.95)", fill: "#07090c" }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </PremiumChartPanel>
                </div>

                <div className="lg:col-span-1">
                  <PremiumChartPanel title="Margin Trend" subtitle={`Last ${months} months`}>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={marginChartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="marginFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(52,211,153,0.28)" />
                              <stop offset="60%" stopColor="rgba(16,185,129,0.10)" />
                              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                            </linearGradient>
                          </defs>

                          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }}
                            tickFormatter={(v) => formatMonthLabel(v as MonthKey)}
                            minTickGap={30}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }}
                            tickFormatter={(v) => {
                              const n = typeof v === "number" ? v : Number(v);
                              return Number.isFinite(n) ? `${n.toFixed(0)}%` : "";
                            }}
                          />
                          <Tooltip
                            cursor={{ stroke: "rgba(52,211,153,0.35)", strokeWidth: 2 }}
                            content={(props) => (
                              <ChartTooltip accent="emerald" valueFormatter={(v) => `${Number(v).toFixed(1)}%`} {...props} />
                            )}
                          />
                          <Area
                            type="monotone"
                            dataKey="marginPct"
                            name="Margin %"
                            stroke="rgba(52,211,153,0.95)"
                            strokeWidth={2.2}
                            fill="url(#marginFill)"
                            fillOpacity={1}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 2, stroke: "rgba(52,211,153,0.95)", fill: "#07090c" }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </PremiumChartPanel>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-baseline justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">Projects</div>
                    <div className="mt-1 text-xs text-zinc-400">Sorted by net profit (descending).</div>
                  </div>
                  <div className="hidden text-xs text-zinc-400 sm:block">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Showing {data.projects.length}
                    </span>
                  </div>
                </div>
                {projectTable}
              </div>
            </div>
          ) : dataError ? (
            <div className="mt-6 text-sm text-rose-400" role="alert">
              {dataError}
            </div>
          ) : (
            <div className="mt-6 text-sm text-zinc-400">Select an organization to view metrics.</div>
          )}
        </div>
      </div>
    </div>
  );
}

