import { z } from "zod";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import {
  getExpenseRowsByProjectsInRange,
  getMonthlyExpenseTrendsWithTravel,
  listProjectsByOrganization,
  getMonthlyRevenueTrends,
  getProjectSummariesByOrganization,
} from "@/services/finance";
import {
  calculateOrgProfitMargin,
  calculateBurnRate,
  calculateProjectExpenses,
  calculateProjectRevenue,
} from "@/lib/finance/metrics";
import type {
  AnomalyReport,
  ExpenseAnomaly,
  ExpensePoint,
  ForecastPoint,
  MoneyPoint,
} from "@/types/finance";

import type { GeminiToolDeclaration } from "@/lib/ai/gemini";

const MAX_ANOMALY_ITEMS = 10;

// ─── Expense row shape returned by getExpenseRowsByProjectsInRange ────────────
// Add / remove fields here if the service query changes.
interface ExpenseRow {
  expenseId: string;
  projectId: string;
  amount: number;
  dateIso: string;
  expenseType: string;
  technicianId: string | null;
  description: string | null;
}

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

function clampNonNegative(n: number): number {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function linearRegressionForecast(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const xs = Array.from({ length: n }, (_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - xMean;
    numerator += dx * (values[i] - yMean);
    denominator += dx * dx;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

function monthKeyToDateUTC(monthKey: string): Date {
  const [yyyy, mm] = monthKey.split("-").map((x) => Number(x));
  return new Date(Date.UTC(yyyy, (mm ?? 1) - 1, 1, 0, 0, 0));
}

function dateUTCToMonthKey(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

const getOrgProfitMarginArgs = z.object({
  orgId: z.string().min(1),
});

const getProjectFinancialsArgs = z.object({
  projectId: z.string().min(1),
});

const getExpenseTrendsArgs = z.object({
  orgId: z.string().min(1),
  dateRange: z
    .object({
      months: z.number().int().positive().max(60),
    })
    .default({ months: 12 }),
});

const detectAnomaliesArgs = z.object({
  orgId: z.string().min(1),
});

const forecastExpensesArgs = z.object({
  orgId: z.string().min(1),
});

const getBurnRateArgs = z.object({
  orgId: z.string().min(1),
});

const getLosingProjectsArgs = z.object({
  orgId: z.string().min(1),
  months: z.number().int().positive().max(60).default(12),
});

export type ToolName =
  | "getOrgProfitMargin"
  | "getBurnRate"
  | "getProjectFinancials"
  | "getExpenseTrends"
  | "detectAnomalies"
  | "forecastExpenses"
  | "getLosingProjects"
  | "searchOrganizationsByName";

// Gemini tools declarations.
export const geminiTools: Array<{ functionDeclarations: GeminiToolDeclaration[] }> = [
  {
    functionDeclarations: [
      {
        name: "getOrgProfitMargin",
        description: "Get the organization profit margin percentage for the default reporting period.",
        parameters: {
          type: "object",
          properties: {
            orgId: { type: "string", description: "Organization ID (UUID)." },
          },
          required: ["orgId"],
        },
      },
      {
        name: "getBurnRate",
        description: "Get the organization burn rate (average net burn over the last few months).",
        parameters: {
          type: "object",
          properties: {
            orgId: { type: "string", description: "Organization ID (UUID)." },
          },
          required: ["orgId"],
        },
      },
      {
        name: "getProjectFinancials",
        description: "Get revenue, expenses, net profit, and margin for a project.",
        parameters: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID (UUID)." },
          },
          required: ["projectId"],
        },
      },
      {
        name: "getExpenseTrends",
        description:
          "Get monthly expense trends, including travel expenses and travel cost per survey, plus associated revenue/margin.",
        parameters: {
          type: "object",
          properties: {
            orgId: { type: "string", description: "Organization ID (UUID)." },
            dateRange: {
              type: "object",
              description: "Time window for trends.",
              properties: {
                months: { type: "integer", description: "Number of months to include (max 60)." },
              },
              required: ["months"],
            },
          },
          required: ["orgId", "dateRange"],
        },
      },
      {
        name: "detectAnomalies",
        description:
          "Audit technician-related expenses for duplicates, unusually large purchases, and suspicious technician behavior.",
        parameters: {
          type: "object",
          properties: {
            orgId: { type: "string", description: "Organization ID (UUID)." },
          },
          required: ["orgId"],
        },
      },
      {
        name: "forecastExpenses",
        description:
          "Forecast next-quarter total expenses (and travel expenses) based on historical trends.",
        parameters: {
          type: "object",
          properties: {
            orgId: { type: "string", description: "Organization ID (UUID)." },
          },
          required: ["orgId"],
        },
      },
      {
        name: "getLosingProjects",
        description:
          "List projects that are losing money (net profit < 0) for the reporting window. Useful for questions like 'Which projects are losing money?'.",
        parameters: {
          type: "object",
          properties: {
            orgId: { type: "string", description: "Organization ID (UUID)." },
            months: { type: "integer", description: "Reporting window months (max 60).", default: 12 },
          },
          required: ["orgId", "months"],
        },
      },
      {
        name: "searchOrganizationsByName",
        description:
          "Search organizations by partial name. Use for questions like 'all Home Depot locations'.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Partial name to search for." },
          },
          required: ["query"],
        },
      },
    ],
  },
];

async function searchOrganizationsByName(args: unknown) {
  const parsed = z
    .object({
      query: z.string().min(1),
    })
    .parse(args);

  const { data, error } = await supabaseAdminClient
    .from("organizations")
    .select("id,name")
    .ilike("name", `%${parsed.query}%`)
    .limit(20)
    .order("name");
  if (error) throw new Error(`searchOrganizationsByName failed: ${error.message}`);
  const orgRowSchema = z.object({ id: z.string(), name: z.string() });
  const rows = z.array(orgRowSchema).parse(data ?? []);
  return { organizations: rows.map((o) => ({ id: o.id, name: o.name })) };
}

export async function executeTool(toolName: ToolName, args: unknown): Promise<unknown> {
  switch (toolName) {
    case "getOrgProfitMargin": {
      const { orgId } = getOrgProfitMarginArgs.parse(args);
      const marginPct = await calculateOrgProfitMargin(orgId);
      return { marginPct };
    }
    case "getBurnRate": {
      const { orgId } = getBurnRateArgs.parse(args);
      const burnRate = await calculateBurnRate(orgId);
      return { burnRate };
    }
    case "getProjectFinancials": {
      const { projectId } = getProjectFinancialsArgs.parse(args);
      const revenueTotal = await calculateProjectRevenue(projectId);
      const expensesTotal = await calculateProjectExpenses(projectId);
      const netProfit = revenueTotal - expensesTotal;
      const marginPct = revenueTotal === 0 ? 0 : (netProfit / revenueTotal) * 100;
      return { revenueTotal, expensesTotal, netProfit, marginPct };
    }
    case "getExpenseTrends": {
      const parsed = getExpenseTrendsArgs.parse(args);
      const { orgId, dateRange } = parsed;
      const months = dateRange.months;
      const expenses: ExpensePoint[] = await getMonthlyExpenseTrendsWithTravel(supabaseAdminClient, orgId, months);
      const revenue: MoneyPoint[] = await getMonthlyRevenueTrends(supabaseAdminClient, orgId, months);

      // Merge on month so the model can interpret ratios consistently.
      const byMonthExpense = new Map(expenses.map((p) => [p.month, p]));
      const merged = revenue.map((r) => {
        const e = byMonthExpense.get(r.month);
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

      return { months, series: merged };
    }
    case "detectAnomalies": {
      const { orgId } = detectAnomaliesArgs.parse(args);
      const projects = await listProjectsByOrganization(supabaseAdminClient, orgId);
      const projectIds = projects.map((p) => p.projectId);
      const end = new Date();
      const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const range = { startDate: isoDate(start), endDate: isoDate(end) };

      // Cast to ExpenseRow[] so TypeScript knows about the `description` field.
      const expenseRows = (await getExpenseRowsByProjectsInRange(
        supabaseAdminClient,
        projectIds,
        range,
      )) as ExpenseRow[];

      const anomalies: ExpenseAnomaly[] = [];

      // 1) Duplicate expenses (same technician, amount, description, and day)
      const duplicatesByKey = new Map<
        string,
        { count: number; expenseIds: string[]; amount: number; technicianId: string | null; description: string | null; dateIso: string }
      >();
      for (const e of expenseRows) {
        const key = [
          e.technicianId ?? "unknown",
          String(e.amount),
          e.description ?? "",
          e.dateIso,
        ].join("|");

        const existing = duplicatesByKey.get(key);
        if (existing) {
          existing.count += 1;
          existing.expenseIds.push(e.expenseId);
        } else {
          duplicatesByKey.set(key, {
            count: 1,
            expenseIds: [e.expenseId],
            amount: e.amount,
            technicianId: e.technicianId,
            description: e.description,
            dateIso: e.dateIso,
          });
        }
      }

      const duplicateCandidates = Array.from(duplicatesByKey.entries())
        .filter(([, v]) => v.count >= 2)
        .slice(0, MAX_ANOMALY_ITEMS);

      for (const [, v] of duplicateCandidates) {
        anomalies.push({
          type: "duplicate_expenses",
          severity: v.count >= 4 ? "high" : "medium",
          title: "Potential duplicate expenses",
          description:
            "Multiple expenses share the same technician, amount, description, and date. This may indicate manual duplication or billing errors.",
          details: {
            technicianId: v.technicianId,
            amount: v.amount,
            description: v.description,
            dateIso: v.dateIso,
            expenseIds: v.expenseIds,
            count: v.count,
          },
        });
      }

      // 2) Unusually large purchases
      const amounts = expenseRows.map((e) => e.amount);
      const sorted = [...amounts].sort((a, b) => a - b);
      if (sorted.length >= 10) {
        const idx = Math.floor(sorted.length * 0.95);
        const p95 = sorted[Math.min(idx, sorted.length - 1)] ?? 0;
        const large = expenseRows
          .filter((e) => e.amount >= p95 && e.amount > 0)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, MAX_ANOMALY_ITEMS);

        if (large.length > 0) {
          anomalies.push({
            type: "unusual_large_purchase",
            severity: "high",
            title: "Unusually large expense(s)",
            description:
              "One or more expenses are above the organization's 95th percentile expense amount in the selected auditing window.",
            details: {
              auditWindow: { startDate: range.startDate, endDate: range.endDate },
              p95Amount: p95,
              largeExpenses: large.map((e) => ({
                expenseId: e.expenseId,
                technicianId: e.technicianId,
                amount: e.amount,
                expenseType: e.expenseType,
                description: e.description,
                dateIso: e.dateIso,
              })),
            },
          });
        }
      }

      // 3) Suspicious technician behavior (high frequency vs peer average)
      const byTechnician = new Map<
        string,
        { technicianId: string; count: number; totalAmount: number }
      >();
      for (const e of expenseRows) {
        if (!e.technicianId) continue;
        const existing = byTechnician.get(e.technicianId);
        if (existing) {
          existing.count += 1;
          existing.totalAmount += e.amount;
        } else {
          byTechnician.set(e.technicianId, {
            technicianId: e.technicianId,
            count: 1,
            totalAmount: e.amount,
          });
        }
      }

      const technicianStats = Array.from(byTechnician.values());
      if (technicianStats.length >= 3) {
        const counts = technicianStats.map((t) => t.count);
        const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance =
          counts.reduce((acc, n) => acc + (n - avg) * (n - avg), 0) / counts.length;
        const std = Math.sqrt(variance);
        const threshold = avg + 2 * std;

        const suspicious = technicianStats
          .filter((t) => t.count >= threshold && t.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, MAX_ANOMALY_ITEMS);

        if (suspicious.length > 0) {
          anomalies.push({
            type: "suspicious_technician",
            severity: suspicious.length >= 2 ? "high" : "medium",
            title: "Potentially suspicious technician expense patterns",
            description:
              "A technician shows an unusually high number of expenses compared to the organization's peers in the audit window.",
            details: {
              auditWindow: { startDate: range.startDate, endDate: range.endDate },
              threshold: { avg, std, threshold },
              technicians: suspicious,
            },
          });
        }
      }

      const report: AnomalyReport = {
        summary:
          anomalies.length === 0
            ? "No significant anomalies detected in the selected audit window."
            : `Detected ${anomalies.length} potential anomaly category/cases.`,
        anomalies,
      };

      return report;
    }
    case "forecastExpenses": {
      const { orgId } = forecastExpensesArgs.parse(args);
      const historyMonths = 24;
      const horizonMonths = 3;

      const expenseSeries: ExpensePoint[] = await getMonthlyExpenseTrendsWithTravel(
        supabaseAdminClient,
        orgId,
        historyMonths,
      );

      const totalY = expenseSeries.map((p) => p.totalExpenses);
      const travelY = expenseSeries.map((p) => p.travelExpenses);

      const totalModel = linearRegressionForecast(totalY);
      const travelModel = linearRegressionForecast(travelY);

      const lastMonthKey = expenseSeries[expenseSeries.length - 1]?.month ?? dateUTCToMonthKey(new Date());
      const lastDate = monthKeyToDateUTC(lastMonthKey);

      const forecast = Array.from({ length: horizonMonths }, (_, i) => {
        const futureIndex = totalY.length + i;
        const monthDate = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth() + 1 + i, 1));
        const month = dateUTCToMonthKey(monthDate);
        const forecastExpensesTotal = clampNonNegative(totalModel.slope * futureIndex + totalModel.intercept);
        const forecastTravelExpenses = clampNonNegative(travelModel.slope * futureIndex + travelModel.intercept);
        return { month, forecastExpensesTotal, forecastTravelExpenses };
      });

      // Provide a compact numeric summary as well.
      const forecastExpensesTotal = forecast.reduce((acc, p) => acc + p.forecastExpensesTotal, 0);
      const forecastTravelExpenses = forecast.reduce((acc, p) => acc + p.forecastTravelExpenses, 0);

      const result = {
        historyMonths,
        horizonMonths,
        forecastTotal: forecastExpensesTotal,
        forecastTravelTotal: forecastTravelExpenses,
        trend: {
          total: { slope: totalModel.slope, intercept: totalModel.intercept },
          travel: { slope: travelModel.slope, intercept: travelModel.intercept },
        },
        forecast,
      } satisfies {
        historyMonths: number;
        horizonMonths: number;
        forecastTotal: number;
        forecastTravelTotal: number;
        trend: {
          total: { slope: number; intercept: number };
          travel: { slope: number; intercept: number };
        };
        forecast: ForecastPoint[];
      };

      return result;
    }
    case "getLosingProjects": {
      const { orgId, months } = getLosingProjectsArgs.parse(args);
      const range = defaultRangeMonths(months);

      const summaries = await getProjectSummariesByOrganization(supabaseAdminClient, orgId, range);
      const losing = summaries
        .filter((p) => p.netProfit < 0)
        .sort((a, b) => a.netProfit - b.netProfit)
        .slice(0, 15);

      return { losingProjects: losing };
    }
    case "searchOrganizationsByName": {
      return searchOrganizationsByName(args);
    }
    default:
      // Exhaustiveness guard
      throw new Error(`Unsupported tool: ${toolName}`);
  }
}