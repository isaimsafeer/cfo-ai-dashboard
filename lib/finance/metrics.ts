import { supabaseAdminClient } from "@/lib/supabase/admin";
import {
  getBurnRateSeries,
  getMonthlyExpenseTrendsWithTravel,
  getMonthlyRevenueTrends,
  getOrgTotalsByRange,
  getProjectSummariesByOrganization,
} from "@/services/finance";
import type { ExpensePoint, MoneyPoint } from "@/types/finance";
import type { UUID } from "@/types/database";

const TRAVEL_COST_PER_SURVEY_RANGE_MONTHS = 24;
const BURN_RATE_RANGE_MONTHS = 3;

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function calculateProjectRevenue(projectId: UUID): Promise<number> {
  const orgId = await getProjectOrganizationId(projectId);
  const summaries = await getProjectSummariesByOrganization(
    supabaseAdminClient,
    orgId,
  );
  const match = summaries.find((s) => s.projectId === projectId);
  return match?.revenueTotal ?? 0;
}

export async function calculateProjectExpenses(projectId: UUID): Promise<number> {
  const orgId = await getProjectOrganizationId(projectId);
  const summaries = await getProjectSummariesByOrganization(
    supabaseAdminClient,
    orgId,
  );
  const match = summaries.find((s) => s.projectId === projectId);
  return match?.expensesTotal ?? 0;
}

export async function calculateProjectMargin(projectId: UUID): Promise<number> {
  const orgId = await getProjectOrganizationId(projectId);
  const summaries = await getProjectSummariesByOrganization(
    supabaseAdminClient,
    orgId,
  );
  const match = summaries.find((s) => s.projectId === projectId);
  if (!match) return 0;
  return match.marginPct;
}

export async function calculateOrgProfitMargin(orgId: UUID): Promise<number> {
  const totals2 = await getOrgTotalsByRange(supabaseAdminClient, orgId);
  return totals2.marginPct;
}

async function getProjectOrganizationId(projectId: UUID): Promise<UUID> {
  const { data, error } = await supabaseAdminClient
    .from("projects")
    .select("organization_id")
    .eq("id", projectId)
    .single();
  if (error) throw new Error(`getProjectOrganizationId failed: ${error.message}`);
  if (!data?.organization_id) throw new Error(`Project not found: ${projectId}`);
  return data.organization_id as UUID;
}

export async function calculateTravelCostPerSurvey(orgId: UUID): Promise<number> {
  const travelSeries = await getMonthlyExpenseTrendsWithTravel(
    supabaseAdminClient,
    orgId,
    TRAVEL_COST_PER_SURVEY_RANGE_MONTHS,
  );
  const totalTravel = travelSeries.reduce((acc, p) => acc + p.travelExpenses, 0);
  const totalSurveys = travelSeries.reduce((acc, p) => acc + p.surveysCount, 0);
  return totalSurveys === 0 ? 0 : totalTravel / totalSurveys;
}

export async function calculateBurnRate(orgId: UUID): Promise<number> {
  const burnSeries = await getBurnRateSeries(
    supabaseAdminClient,
    orgId,
    BURN_RATE_RANGE_MONTHS,
  );
  const avgNetBurn = average(burnSeries.map((p) => p.netBurn));
  return avgNetBurn;
}

export async function getMonthlyExpenses(orgId: UUID, months: number): Promise<ExpensePoint[]> {
  return getMonthlyExpenseTrendsWithTravel(supabaseAdminClient, orgId, months);
}

export async function getRevenueTrends(orgId: UUID, months: number): Promise<MoneyPoint[]> {
  return getMonthlyRevenueTrends(supabaseAdminClient, orgId, months);
}

export async function calculateOrgNetProfitAndTotals(orgId: UUID): Promise<{
  revenueTotal: number;
  expensesTotal: number;
  netProfit: number;
  marginPct: number;
}> {
  const totals = await getOrgTotalsByRange(supabaseAdminClient, orgId);
  return totals;
}

