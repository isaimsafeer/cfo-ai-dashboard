import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import {
  getMonthlyExpenseTrendsWithTravel,
  getMonthlyRevenueTrends,
  getOrgTotalsByRange,
  getProjectSummariesByOrganization,
  listOrganizations,
} from "@/services/finance";

const postSchema = z.object({
  orgId: z.string().min(1),
  months: z.number().int().positive().max(60).default(12),
});

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59));
}

function addMonthsUTC(base: Date, months: number): Date {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function defaultRangeMonths(months: number) {
  const now = new Date();
  const end = endOfMonthUTC(now);
  const start = startOfMonthUTC(addMonthsUTC(now, -months + 1));
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

export async function GET() {
  const organizations = await listOrganizations(supabaseAdminClient);
  return NextResponse.json({ organizations });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { orgId, months } = parsed.data;
  const range = defaultRangeMonths(months);

  const [revSeries, expSeries, projects, totals] = await Promise.all([
    getMonthlyRevenueTrends(supabaseAdminClient, orgId, months),
    getMonthlyExpenseTrendsWithTravel(supabaseAdminClient, orgId, months),
    getProjectSummariesByOrganization(supabaseAdminClient, orgId, range),
    getOrgTotalsByRange(supabaseAdminClient, orgId, range),
  ]);

  const expByMonth = new Map(expSeries.map((p) => [p.month, p]));
  const mergedSeries = revSeries.map((r) => {
    const e = expByMonth.get(r.month);
    return {
      month: r.month,
      revenueTotal: r.revenueTotal,
      expensesTotal: r.expensesTotal,
      marginPct: r.marginPct,
      travelExpenses: e?.travelExpenses ?? 0,
      surveysCount: e?.surveysCount ?? 0,
      travelCostPerSurvey: e?.travelCostPerSurvey ?? 0,
    };
  });

  return NextResponse.json({
    orgId,
    months,
    metrics: totals,
    projects,
    series: mergedSeries,
  });
}

