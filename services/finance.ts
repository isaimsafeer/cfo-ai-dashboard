import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  BurnRatePoint,
  ExpensePoint,
  ISODateString,
  MonthKey,
  MoneyPoint,
  OrgFinancialMetrics,
  Organization,
  ProjectSummary,
} from "@/types/finance";

export interface DateRange {
  startDate: ISODateString;
  endDate: ISODateString;
}

const organizationRowSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const projectRowSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  name: z.string(),
  start_date: z.string(),
});

const revenueRowSchema = z.object({
  project_id: z.string(),
  amount: z.number(),
  date: z.string(),
});

const expenseRowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  amount: z.number(),
  date: z.string(),
  category: z.string(),
  user_id: z.string().nullable(),
});

const userRowSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  email: z.string(),
  role: z.string(),
});

function isoDate(d: Date): ISODateString {
  return d.toISOString().slice(0, 10);
}

function monthKeyFromDate(dateIso: string): MonthKey {
  const d = new Date(dateIso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59));
}

function defaultRangeMonths(months: number): DateRange {
  const now = new Date();
  const end = endOfMonthUTC(now);
  const start = startOfMonthUTC(addMonths(now, -months + 1));
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function isTravelExpense(category: string): boolean {
  const t = category.toLowerCase();
  return t === "travel" || t.includes("travel");
}

export async function listOrganizations(
  supabase: SupabaseClient,
): Promise<Organization[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id,name")
    .order("name");
  if (error) throw new Error(`listOrganizations failed: ${error.message}`);
  const parsed = z.array(organizationRowSchema).parse(data ?? []);
  return parsed;
}

export async function searchOrganizationsByName(
  supabase: SupabaseClient,
  query: string,
  limit = 20,
): Promise<Organization[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id,name")
    .ilike("name", `%${query}%`)
    .limit(limit);
  if (error) throw new Error(`searchOrganizationsByName failed: ${error.message}`);
  const parsed = z.array(organizationRowSchema).parse(data ?? []);
  return parsed;
}

export async function listUsersByOrganization(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ id: string; email: string; role: string }>> {
  const { data, error } = await supabase
    .from("users")
    .select("id,email,role,org_id")
    .eq("org_id", orgId);
  if (error) throw new Error(`listUsersByOrganization failed: ${error.message}`);
  const parsed = z.array(userRowSchema).parse(data ?? []);
  return parsed.map((u) => ({ id: u.id, email: u.email, role: u.role }));
}

export async function listProjectsByOrganization(
  supabase: SupabaseClient,
  orgId: string,
): Promise<
  Array<{
    projectId: string;
    projectName: string;
    startDate: ISODateString;
    surveysCount: number;
  }>
> {
  const { data, error } = await supabase
    .from("projects")
    .select("id,org_id,name,start_date")
    .eq("org_id", orgId);
  if (error) throw new Error(`listProjectsByOrganization failed: ${error.message}`);
  const parsed = z.array(projectRowSchema).parse(data ?? []);
  return parsed.map((p) => ({
    projectId: p.id,
    projectName: p.name,
    startDate: isoDate(new Date(p.start_date)),
    surveysCount: 0, // surveys_count column does not exist in DB
  }));
}

export async function getRevenueRowsByProjectsInRange(
  supabase: SupabaseClient,
  projectIds: string[],
  range: DateRange,
): Promise<Array<{ projectId: string; amount: number; dateIso: string }>> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from("revenue")
    .select("project_id,amount,date")
    .in("project_id", projectIds)
    .gte("date", range.startDate)
    .lte("date", range.endDate);
  if (error) throw new Error(`getRevenueRowsByProjectsInRange failed: ${error.message}`);
  const parsed = z.array(revenueRowSchema).parse(data ?? []);
  return parsed.map((r) => ({
    projectId: r.project_id,
    amount: r.amount,
    dateIso: isoDate(new Date(r.date)),
  }));
}

export async function getExpenseRowsByProjectsInRange(
  supabase: SupabaseClient,
  projectIds: string[],
  range: DateRange,
): Promise<
  Array<{
    expenseId: string;
    projectId: string;
    amount: number;
    dateIso: string;
    expenseType: string;
    technicianId: string | null;
  }>
> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from("expenses")
    .select("id,project_id,amount,date,category,user_id")
    .in("project_id", projectIds)
    .gte("date", range.startDate)
    .lte("date", range.endDate);
  if (error) throw new Error(`getExpenseRowsByProjectsInRange failed: ${error.message}`);
  const parsed = z.array(expenseRowSchema).parse(data ?? []);
  return parsed.map((r) => ({
    expenseId: r.id,
    projectId: r.project_id,
    amount: r.amount,
    dateIso: isoDate(new Date(r.date)),
    expenseType: r.category,   // mapped from DB column `category`
    technicianId: r.user_id,   // mapped from DB column `user_id`
  }));
}

function sum(nums: number[]): number {
  return nums.reduce((acc, n) => acc + n, 0);
}

export async function getOrgTotalsByRange(
  supabase: SupabaseClient,
  orgId: string,
  range = defaultRangeMonths(12),
): Promise<OrgFinancialMetrics> {
  const projects = await listProjectsByOrganization(supabase, orgId);
  const projectIds = projects.map((p) => p.projectId);

  const [revenueRows, expenseRows] = await Promise.all([
    getRevenueRowsByProjectsInRange(supabase, projectIds, range),
    getExpenseRowsByProjectsInRange(supabase, projectIds, range),
  ]);

  const revenueTotal = sum(revenueRows.map((r) => r.amount));
  const expensesTotal = sum(expenseRows.map((e) => e.amount));

  return {
    revenueTotal,
    expensesTotal,
    netProfit: revenueTotal - expensesTotal,
    marginPct: revenueTotal === 0 ? 0 : ((revenueTotal - expensesTotal) / revenueTotal) * 100,
  };
}

export async function getProjectSummariesByOrganization(
  supabase: SupabaseClient,
  orgId: string,
  range = defaultRangeMonths(12),
): Promise<ProjectSummary[]> {
  const projects = await listProjectsByOrganization(supabase, orgId);
  const projectIds = projects.map((p) => p.projectId);

  const [revenueRows, expenseRows] = await Promise.all([
    getRevenueRowsByProjectsInRange(supabase, projectIds, range),
    getExpenseRowsByProjectsInRange(supabase, projectIds, range),
  ]);

  const revenueByProject = new Map<string, number>();
  for (const row of revenueRows) {
    revenueByProject.set(row.projectId, (revenueByProject.get(row.projectId) ?? 0) + row.amount);
  }

  const expensesByProject = new Map<string, number>();
  for (const row of expenseRows) {
    expensesByProject.set(row.projectId, (expensesByProject.get(row.projectId) ?? 0) + row.amount);
  }

  return projects.map((p) => {
    const revenueTotal = revenueByProject.get(p.projectId) ?? 0;
    const expensesTotal = expensesByProject.get(p.projectId) ?? 0;
    const netProfit = revenueTotal - expensesTotal;
    const marginPct = revenueTotal === 0 ? 0 : (netProfit / revenueTotal) * 100;

    return {
      projectId: p.projectId,
      projectName: p.projectName,
      revenueTotal,
      expensesTotal,
      netProfit,
      marginPct,
    };
  });
}

export async function getMonthlyRevenueTrends(
  supabase: SupabaseClient,
  orgId: string,
  months: number,
): Promise<MoneyPoint[]> {
  const range = defaultRangeMonths(months);
  const projects = await listProjectsByOrganization(supabase, orgId);
  const projectIds = projects.map((p) => p.projectId);

  const [revenueRows, expenseRows] = await Promise.all([
    getRevenueRowsByProjectsInRange(supabase, projectIds, range),
    getExpenseRowsByProjectsInRange(supabase, projectIds, range),
  ]);

  const monthsList: MonthKey[] = [];
  const start = new Date(`${range.startDate}T00:00:00Z`);
  for (let i = 0; i < months; i += 1) {
    monthsList.push(monthKeyFromDate(startOfMonthUTC(addMonths(start, i)).toISOString()));
  }

  const revenueByMonth = new Map<MonthKey, number>();
  const expensesByMonth = new Map<MonthKey, number>();

  for (const r of revenueRows) {
    const key = monthKeyFromDate(r.dateIso);
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + r.amount);
  }
  for (const e of expenseRows) {
    const key = monthKeyFromDate(e.dateIso);
    expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + e.amount);
  }

  return monthsList.map((month) => {
    const revenueTotal = revenueByMonth.get(month) ?? 0;
    const expensesTotal = expensesByMonth.get(month) ?? 0;
    const netProfit = revenueTotal - expensesTotal;
    const marginPct = revenueTotal === 0 ? 0 : (netProfit / revenueTotal) * 100;
    return { month, revenueTotal, expensesTotal, marginPct };
  });
}

export async function getMonthlyExpenseTrendsWithTravel(
  supabase: SupabaseClient,
  orgId: string,
  months: number,
): Promise<ExpensePoint[]> {
  const range = defaultRangeMonths(months);
  const projects = await listProjectsByOrganization(supabase, orgId);
  const projectIds = projects.map((p) => p.projectId);

  const expenseRows = await getExpenseRowsByProjectsInRange(supabase, projectIds, range);

  const monthsList: MonthKey[] = [];
  const start = new Date(`${range.startDate}T00:00:00Z`);
  for (let i = 0; i < months; i += 1) {
    monthsList.push(monthKeyFromDate(startOfMonthUTC(addMonths(start, i)).toISOString()));
  }

  const expensesByMonth = new Map<MonthKey, number>();
  const travelExpensesByMonth = new Map<MonthKey, number>();

  for (const e of expenseRows) {
    const key = monthKeyFromDate(e.dateIso);
    expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + e.amount);
    if (isTravelExpense(e.expenseType)) {
      travelExpensesByMonth.set(key, (travelExpensesByMonth.get(key) ?? 0) + e.amount);
    }
  }

  return monthsList.map((month) => {
    const totalExpenses = expensesByMonth.get(month) ?? 0;
    const travelExpenses = travelExpensesByMonth.get(month) ?? 0;
    // surveysCount always 0 — surveys_count column does not exist in DB
    return { month, totalExpenses, travelExpenses, surveysCount: 0, travelCostPerSurvey: 0 };
  });
}

export async function getBurnRateSeries(
  supabase: SupabaseClient,
  orgId: string,
  months = 3,
): Promise<BurnRatePoint[]> {
  const range = defaultRangeMonths(months);
  const projects = await listProjectsByOrganization(supabase, orgId);
  const projectIds = projects.map((p) => p.projectId);

  const [revenueRows, expenseRows] = await Promise.all([
    getRevenueRowsByProjectsInRange(supabase, projectIds, range),
    getExpenseRowsByProjectsInRange(supabase, projectIds, range),
  ]);

  const monthsList: MonthKey[] = [];
  const start = new Date(`${range.startDate}T00:00:00Z`);
  for (let i = 0; i < months; i += 1) {
    monthsList.push(monthKeyFromDate(startOfMonthUTC(addMonths(start, i)).toISOString()));
  }

  const revenueByMonth = new Map<MonthKey, number>();
  const expensesByMonth = new Map<MonthKey, number>();
  for (const r of revenueRows) {
    const key = monthKeyFromDate(r.dateIso);
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + r.amount);
  }
  for (const e of expenseRows) {
    const key = monthKeyFromDate(e.dateIso);
    expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + e.amount);
  }

  return monthsList.map((month) => {
    const revenueTotal = revenueByMonth.get(month) ?? 0;
    const expensesTotal = expensesByMonth.get(month) ?? 0;
    const netBurn = expensesTotal - revenueTotal;
    return { month, revenueTotal, expensesTotal, netBurn };
  });
}