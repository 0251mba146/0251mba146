import type {
  ApexDatabase,
  PlanTier,
  UserRole,
  ModuleKey,
} from './types.ts';

export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(safe));
}

export function formatCompactINR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  }
  return formatINR(amount);
}

export function formatNumberIN(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatPct(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(1)}%`;
}

export function getPlanPrice(
  plan: PlanTier,
  pricing = { conservative: 20000, standard: 25000, premium: 30000 }
): number {
  if (plan === 'Conservative Plan') return pricing.conservative;
  if (plan === 'Premium Plan') return pricing.premium;
  return pricing.standard;
}

export interface ComputedMetrics {
  // Base Benchmark Assumptions (from Venture Plan / Settings)
  benchmark: {
    sellingPrice: number;
    variableCostPerCustomer: number;
    expectedCustomers: number;
    monthlyFixedCost: number;
    expectedMonthlyRevenue: number;
    totalVariableCost: number;
    totalMonthlyOperatingCost: number;
    expectedOperatingSurplus: number;
    contributionPerCustomer: number;
    contributionMarginPct: number;
    breakEvenCustomersExact: number;
    breakEvenCustomersCeil: number;
  };
  // Live Database-Calculated KPIs
  live: {
    totalRevenue: number;
    currentMonthRevenue: number;
    previousMonthRevenue: number;
    mrr: number;
    arr: number;
    totalCustomers: number;
    paidCustomers: number;
    trialCustomers: number;
    activeSubscriptions: number;
    overdueSubscriptions: number;
    expiringSubscriptions: number;
    totalExpenses: number;
    currentMonthExpenses: number;
    monthlyFixedExpenses: number;
    monthlyVariableExpenses: number;
    monthlyOtherExpenses: number;
    contributionPerCustomerActual: number;
    contributionMarginPctActual: number;
    operatingSurplusTotal: number;
    monthlyProfitability: number;
    breakEvenCustomersActual: number;
    cac: number;
    customerGrowthRatePct: number;
    revenueGrowthRatePct: number;
    expenseGrowthRatePct: number;
    subscriptionGrowthRatePct: number;
    customerRetentionRatePct: number;
    avgReportingHoursSaved: number;
    // Sales pipeline metrics
    totalLeads: number;
    qualifiedLeads: number;
    upcomingFollowUps: number;
    demoConversionRatePct: number;
    leadToCustomerConversionPct: number;
    expectedSalesRevenue: number;
    // Monthly series (6 months)
    monthlySeries: Array<{
      monthKey: string;
      label: string;
      revenue: number;
      subscriptionRevenue: number;
      otherRevenue: number;
      fixedExpenses: number;
      variableExpenses: number;
      otherExpenses: number;
      totalExpenses: number;
      operatingSurplus: number;
      activeCustomers: number;
      activeSubscriptions: number;
      newCustomers: number;
    }>;
  };
}

export function computePlatformMetrics(db: ApexDatabase, referenceMonth = '2026-11'): ComputedMetrics {
  const { assumptions, customers, leads, subscriptions, revenueTransactions, expenseTransactions, marketingCampaigns, customerFeedback } = db;

  // 1. Venture Benchmark Engine
  const sellingPrice = assumptions.sellingPriceMonthly;
  const variableCostPerCustomer = assumptions.variableCostPerCustomer;
  const expectedCustomers = assumptions.expectedBaseCustomers;
  const monthlyFixedCost = assumptions.monthlyFixedCost;

  const expectedMonthlyRevenue = sellingPrice * expectedCustomers;
  const totalVariableCost = variableCostPerCustomer * expectedCustomers;
  const totalMonthlyOperatingCost = monthlyFixedCost + totalVariableCost;
  const expectedOperatingSurplus = expectedMonthlyRevenue - totalMonthlyOperatingCost;
  const contributionPerCustomer = sellingPrice - variableCostPerCustomer;
  const contributionMarginPct = sellingPrice > 0 ? (contributionPerCustomer / sellingPrice) * 100 : 0;
  const breakEvenCustomersExact = contributionPerCustomer > 0 ? monthlyFixedCost / contributionPerCustomer : 0;
  const breakEvenCustomersCeil = Math.ceil(breakEvenCustomersExact);

  // 2. Live Database Calculations
  const activeSubs = subscriptions.filter((s) => s.status === 'Active' || s.status === 'Expiring Soon');
  const mrr = activeSubs.reduce((sum, sub) => {
    if (sub.billingFrequency === 'Annual') return sum + sub.subscriptionAmount / 12;
    if (sub.billingFrequency === 'Quarterly') return sum + sub.subscriptionAmount / 3;
    return sum + sub.subscriptionAmount;
  }, 0);
  const arr = mrr * 12;

  const paidCustomers = customers.filter((c) => c.status === 'Paid Customer').length;
  const trialCustomers = customers.filter((c) => c.status === 'Trial Customer').length;
  const inactiveCustomers = customers.filter((c) => c.status === 'Inactive Customer').length;
  const activeCustomerBase = customers.filter((c) => c.status !== 'Inactive Customer').length;
  const customerRetentionRatePct =
    activeCustomerBase + inactiveCustomers > 0
      ? (activeCustomerBase / (activeCustomerBase + inactiveCustomers)) * 100
      : 100;

  const overdueSubscriptions = subscriptions.filter((s) => s.paymentStatus === 'Overdue').length;
  const expiringSubscriptions = subscriptions.filter((s) => s.status === 'Expiring Soon').length;

  const totalRevenue = revenueTransactions.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = expenseTransactions.reduce((sum, e) => sum + e.amount, 0);
  const operatingSurplusTotal = totalRevenue - totalExpenses;

  // Build 6-month sorted window ending at referenceMonth (or latest transaction month)
  const monthKeys = getLastSixMonths(referenceMonth);

  const monthlySeries = monthKeys.map((monthKey, idx) => {
    const revInMonth = revenueTransactions.filter((r) => r.date.startsWith(monthKey));
    const expInMonth = expenseTransactions.filter((e) => e.date.startsWith(monthKey));

    const subscriptionRevenue = revInMonth
      .filter((r) => r.category === 'Subscription Revenue')
      .reduce((s, r) => s + r.amount, 0);
    const otherRevenue = revInMonth
      .filter((r) => r.category !== 'Subscription Revenue')
      .reduce((s, r) => s + r.amount, 0);
    const revenue = subscriptionRevenue + otherRevenue;

    const fixedExpenses = expInMonth
      .filter((e) => e.costType === 'Fixed')
      .reduce((s, e) => s + e.amount, 0);
    const variableExpenses = expInMonth
      .filter((e) => e.costType === 'Variable')
      .reduce((s, e) => s + e.amount, 0);
    const otherExpenses = expInMonth
      .filter((e) => e.costType === 'Other')
      .reduce((s, e) => s + e.amount, 0);
    const monthTotalExp = fixedExpenses + variableExpenses + otherExpenses;

    const newCustomers = customers.filter((c) => c.acquisitionDate.startsWith(monthKey)).length;
    const cumulativeCustomers = customers.filter(
      (c) => c.acquisitionDate.slice(0, 7) <= monthKey && c.status !== 'Inactive Customer'
    ).length;
    const activeSubsAtMonth = subscriptions.filter(
      (s) => s.startDate.slice(0, 7) <= monthKey && s.status !== 'Cancelled'
    ).length;

    const dt = new Date(`${monthKey}-01T00:00:00`);
    const label = dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

    return {
      monthKey,
      label: idx === monthKeys.length - 1 ? `${label}` : label,
      revenue,
      subscriptionRevenue,
      otherRevenue,
      fixedExpenses,
      variableExpenses,
      otherExpenses,
      totalExpenses: monthTotalExp,
      operatingSurplus: revenue - monthTotalExp,
      activeCustomers: cumulativeCustomers,
      activeSubscriptions: activeSubsAtMonth,
      newCustomers,
    };
  });

  const currentMonth = monthlySeries[monthlySeries.length - 1];
  const prevMonth = monthlySeries[monthlySeries.length - 2];

  const currentMonthRevenue = currentMonth?.revenue ?? 0;
  const previousMonthRevenue = prevMonth?.revenue ?? 0;
  const currentMonthExpenses = currentMonth?.totalExpenses ?? 0;
  const previousMonthExpenses = prevMonth?.totalExpenses ?? 0;

  const monthlyFixedExpenses =
    currentMonth && currentMonth.fixedExpenses > 0 ? currentMonth.fixedExpenses : assumptions.monthlyFixedCost;
  const monthlyVariableExpenses =
    currentMonth && currentMonth.variableExpenses > 0
      ? currentMonth.variableExpenses
      : paidCustomers * assumptions.variableCostPerCustomer;
  const monthlyOtherExpenses = currentMonth?.otherExpenses ?? 0;

  const monthlyProfitability = currentMonthRevenue - currentMonthExpenses;

  const avgSellingPriceActual = paidCustomers > 0 ? mrr / paidCustomers : assumptions.sellingPriceMonthly;
  const actualVarPerCust =
    paidCustomers > 0 && monthlyVariableExpenses > 0
      ? monthlyVariableExpenses / paidCustomers
      : assumptions.variableCostPerCustomer;
  const contributionPerCustomerActual = avgSellingPriceActual - actualVarPerCust;
  const contributionMarginPctActual =
    avgSellingPriceActual > 0 ? (contributionPerCustomerActual / avgSellingPriceActual) * 100 : 0;
  const breakEvenCustomersActual =
    contributionPerCustomerActual > 0 ? Math.ceil(monthlyFixedExpenses / contributionPerCustomerActual) : 0;

  // Marketing CAC = Total marketing spend / total paid customers acquired (or campaign paid customers)
  const totalMarketingSpend = marketingCampaigns.reduce((sum, c) => sum + c.actualSpend, 0);
  const campaignPaidCustomers = marketingCampaigns.reduce((sum, c) => sum + c.paidCustomers, 0);
  const cacDenominator = Math.max(campaignPaidCustomers, paidCustomers, 1);
  const cac = totalMarketingSpend / cacDenominator;

  const prevCustomers = prevMonth?.activeCustomers || 1;
  const currCustomers = currentMonth?.activeCustomers || paidCustomers;
  const customerGrowthRatePct = ((currCustomers - prevCustomers) / Math.max(prevCustomers, 1)) * 100;

  const revenueGrowthRatePct =
    previousMonthRevenue > 0
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
      : 0;
  const expenseGrowthRatePct =
    previousMonthExpenses > 0
      ? ((currentMonthExpenses - previousMonthExpenses) / previousMonthExpenses) * 100
      : 0;

  const prevSubs = prevMonth?.activeSubscriptions || 1;
  const currSubs = currentMonth?.activeSubscriptions || activeSubs.length;
  const subscriptionGrowthRatePct = ((currSubs - prevSubs) / Math.max(prevSubs, 1)) * 100;

  // Pipeline KPIs
  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter(
    (l) => !['New Lead', 'Lost'].includes(l.salesStage)
  ).length;
  const todayIso = '2026-11-19';
  const upcomingFollowUps = leads.filter(
    (l) => l.followUpDate >= todayIso && !['Converted', 'Lost'].includes(l.salesStage)
  ).length;
  const demosCompletedOrMore = leads.filter((l) =>
    ['Demo Completed', 'Trial Started', 'Negotiation', 'Converted'].includes(l.salesStage)
  ).length;
  const demosScheduledOrMore = leads.filter((l) =>
    ['Demo Scheduled', 'Demo Completed', 'Trial Started', 'Negotiation', 'Converted'].includes(l.salesStage)
  ).length;
  const convertedLeads = leads.filter((l) => l.salesStage === 'Converted').length;

  const demoConversionRatePct =
    demosScheduledOrMore > 0 ? (demosCompletedOrMore / demosScheduledOrMore) * 100 : 0;
  const leadToCustomerConversionPct =
    totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
  const expectedSalesRevenue = leads
    .filter((l) => !['Converted', 'Lost'].includes(l.salesStage))
    .reduce((sum, l) => sum + l.expectedDealValue * (l.conversionProbability / 100), 0);

  const avgReportingHoursSaved =
    customerFeedback.length > 0
      ? customerFeedback.reduce((s, f) => s + f.timeSavedHoursWeekly, 0) / customerFeedback.length
      : 17.5;

  return {
    benchmark: {
      sellingPrice,
      variableCostPerCustomer,
      expectedCustomers,
      monthlyFixedCost,
      expectedMonthlyRevenue,
      totalVariableCost,
      totalMonthlyOperatingCost,
      expectedOperatingSurplus,
      contributionPerCustomer,
      contributionMarginPct,
      breakEvenCustomersExact,
      breakEvenCustomersCeil,
    },
    live: {
      totalRevenue,
      currentMonthRevenue,
      previousMonthRevenue,
      mrr,
      arr,
      totalCustomers: customers.length,
      paidCustomers,
      trialCustomers,
      activeSubscriptions: activeSubs.length,
      overdueSubscriptions,
      expiringSubscriptions,
      totalExpenses,
      currentMonthExpenses,
      monthlyFixedExpenses,
      monthlyVariableExpenses,
      monthlyOtherExpenses,
      contributionPerCustomerActual,
      contributionMarginPctActual,
      operatingSurplusTotal,
      monthlyProfitability,
      breakEvenCustomersActual,
      cac,
      customerGrowthRatePct,
      revenueGrowthRatePct,
      expenseGrowthRatePct,
      subscriptionGrowthRatePct,
      customerRetentionRatePct,
      avgReportingHoursSaved,
      totalLeads,
      qualifiedLeads,
      upcomingFollowUps,
      demoConversionRatePct,
      leadToCustomerConversionPct,
      expectedSalesRevenue,
      monthlySeries,
    },
  };
}

function getLastSixMonths(endMonth: string): string[] {
  const [yStr, mStr] = endMonth.split('-');
  let year = Number(yStr);
  let month = Number(mStr);
  const result: string[] = [];
  for (let i = 0; i < 6; i++) {
    result.unshift(`${year}-${String(month).padStart(2, '0')}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return result;
}

export const ROLE_PERMISSIONS: Record<
  UserRole,
  {
    label: string;
    description: string;
    editableModules: ModuleKey[];
    visibleModules: ModuleKey[];
  }
> = {
  ADMIN: {
    label: 'Administrator',
    description: 'Full read/write access across all modules, assumptions, users, and automation controls.',
    editableModules: [
      'dashboard',
      'customers',
      'pipeline',
      'subscriptions',
      'financials',
      'analytics',
      'marketing',
      'validation',
      'market',
      'reports',
      'settings',
    ],
    visibleModules: [
      'dashboard',
      'customers',
      'pipeline',
      'subscriptions',
      'financials',
      'analytics',
      'marketing',
      'validation',
      'market',
      'reports',
      'settings',
    ],
  },
  FINANCE_MANAGER: {
    label: 'Finance Manager',
    description: 'Read/write access to financial transactions, subscriptions, reports, and unit economics.',
    editableModules: ['subscriptions', 'financials', 'reports'],
    visibleModules: [
      'dashboard',
      'customers',
      'subscriptions',
      'financials',
      'analytics',
      'market',
      'reports',
    ],
  },
  SALES_MANAGER: {
    label: 'Sales Manager',
    description: 'Read/write access to customers, sales pipeline, marketing campaigns, and venture validation.',
    editableModules: ['customers', 'pipeline', 'marketing', 'validation'],
    visibleModules: [
      'dashboard',
      'customers',
      'pipeline',
      'subscriptions',
      'marketing',
      'validation',
      'market',
      'reports',
    ],
  },
  EXECUTIVE: {
    label: 'Executive (Read-Only)',
    description: 'Read-only access to executive dashboards, analytics, market sizing, and financial reports.',
    editableModules: [],
    visibleModules: [
      'dashboard',
      'analytics',
      'financials',
      'market',
      'validation',
      'reports',
    ],
  },
};

export function canEditModule(role: UserRole, module: ModuleKey): boolean {
  return ROLE_PERMISSIONS[role].editableModules.includes(module);
}

export function canViewModule(role: UserRole, module: ModuleKey): boolean {
  return ROLE_PERMISSIONS[role].visibleModules.includes(module);
}
