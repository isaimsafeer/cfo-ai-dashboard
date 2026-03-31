export type ISODateString = string; // expected format: yyyy-mm-dd
export type MonthKey = string; // expected format: yyyy-mm

export interface Organization {
  id: string;
  name: string;
}

export interface ProjectSummary {
  projectId: string;
  projectName: string;
  revenueTotal: number;
  expensesTotal: number;
  netProfit: number;
  marginPct: number; // profit / revenue * 100
}

export interface OrgFinancialMetrics {
  revenueTotal: number;
  expensesTotal: number;
  netProfit: number;
  marginPct: number;
}

export interface MoneyPoint {
  month: MonthKey;
  revenueTotal: number;
  expensesTotal: number;
  marginPct: number;
}

export interface ExpensePoint {
  month: MonthKey;
  totalExpenses: number;
  travelExpenses: number;
  surveysCount: number;
  travelCostPerSurvey: number;
}

export interface BurnRatePoint {
  month: MonthKey;
  revenueTotal: number;
  expensesTotal: number;
  netBurn: number; // expenses - revenue
}

export interface ForecastPoint {
  month: MonthKey;
  forecastExpensesTotal: number;
  forecastTravelExpenses: number;
}

export interface ExpenseAnomaly {
  type:
    | "duplicate_expenses"
    | "unusual_large_purchase"
    | "suspicious_technician";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  details: Record<string, unknown>;
}

export interface AnomalyReport {
  summary: string;
  anomalies: ExpenseAnomaly[];
}

