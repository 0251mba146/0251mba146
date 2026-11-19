export type UserRole = 'ADMIN' | 'FINANCE_MANAGER' | 'SALES_MANAGER' | 'EXECUTIVE';

export type CustomerStatus =
  | 'Prospect'
  | 'Qualified Lead'
  | 'Demo Scheduled'
  | 'Trial Customer'
  | 'Paid Customer'
  | 'Inactive Customer';

export type PlanTier = 'Conservative Plan' | 'Standard Plan' | 'Premium Plan';

export type SalesStage =
  | 'New Lead'
  | 'Contacted'
  | 'Interested'
  | 'Demo Scheduled'
  | 'Demo Completed'
  | 'Trial Started'
  | 'Negotiation'
  | 'Converted'
  | 'Lost';

export type DemoStatus = 'Not Scheduled' | 'Scheduled' | 'Completed' | 'Rescheduled' | 'Cancelled';

export type BillingFrequency = 'Monthly' | 'Quarterly' | 'Annual';

export type PaymentStatus = 'Paid' | 'Pending' | 'Overdue';

export type SubscriptionStatus = 'Active' | 'Trial' | 'Expiring Soon' | 'Cancelled';

export type RevenueCategory =
  | 'Subscription Revenue'
  | 'Onboarding & Setup'
  | 'API Integration Fee'
  | 'Advisory & Other';

export type ExpenseCategory =
  | 'Fixed Expenses'
  | 'Variable Expenses'
  | 'Employee Salaries'
  | 'Cloud Hosting'
  | 'API Integration Costs'
  | 'Marketing Expenses'
  | 'Administrative Expenses'
  | 'Other Operational Expenses';

export type ExpenseCostType = 'Fixed' | 'Variable' | 'Other';

export type MarketingChannel =
  | 'LinkedIn Sales Navigator'
  | 'Direct Email Campaigns'
  | 'CFO Networks'
  | 'Accounting Consultants'
  | 'B2B SaaS Communities';

export type ValidationStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Overdue';

export type FeedbackValidationStatus = 'Validated' | 'Conditional' | 'Needs Follow-up';

export type ReportPeriodType = 'Monthly' | 'Quarterly' | 'Annual';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  designation: string;
  city: string;
  avatarUrl: string;
  status: 'Active' | 'Inactive';
  lastLogin: string;
}

export interface CustomerRecord {
  id: string;
  companyName: string;
  contactPerson: string;
  designation: string;
  email: string;
  phone: string;
  industry: string;
  companyRevenueRange: string;
  employeeCount: number;
  city: string;
  leadSource: string;
  acquisitionDate: string;
  subscriptionPlan: PlanTier;
  status: CustomerStatus;
  monthlySubscriptionValue: number;
  assignedSalesExecutiveId: string;
  nextFollowUpDate: string;
  remarks: string;
}

export interface LeadRecord {
  id: string;
  companyName: string;
  contactPerson: string;
  jobDesignation: string;
  email: string;
  leadSource: string;
  expectedDealValue: number;
  salesStage: SalesStage;
  followUpDate: string;
  demoStatus: DemoStatus;
  conversionProbability: number;
  assignedEmployeeId: string;
  notes: string;
  convertedCustomerId?: string;
}

export interface SubscriptionRecord {
  id: string;
  customerId: string;
  planName: PlanTier;
  startDate: string;
  endDate: string;
  billingFrequency: BillingFrequency;
  subscriptionAmount: number;
  paymentStatus: PaymentStatus;
  renewalDate: string;
  status: SubscriptionStatus;
}

export interface RevenueTransaction {
  id: string;
  customerId: string;
  subscriptionId: string;
  category: RevenueCategory;
  amount: number;
  date: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  fiscalYear: string;
  paymentMethod: string;
  status: 'Received' | 'Pending' | 'Overdue';
  description: string;
}

export interface ExpenseTransaction {
  id: string;
  category: ExpenseCategory;
  costType: ExpenseCostType;
  vendor: string;
  amount: number;
  date: string;
  department: string;
  approvalStatus: 'Approved' | 'Pending';
  notes: string;
}

export interface MarketingCampaign {
  id: string;
  campaignName: string;
  channel: MarketingChannel;
  weekLabel: string;
  budget: number;
  actualSpend: number;
  leadsGenerated: number;
  demoBookings: number;
  paidCustomers: number;
  status: 'Active' | 'Planned' | 'Completed' | 'Paused';
  ownerId: string;
}

export interface ValidationTask {
  id: string;
  week: 'Week 1' | 'Week 2' | 'Week 3' | 'Week 4';
  taskDescription: string;
  assignedPersonId: string;
  startDate: string;
  dueDate: string;
  target: number;
  targetUnit: string;
  actualAchievement: number;
  status: ValidationStatus;
  performanceRemarks: string;
}

export interface CustomerFeedbackRecord {
  id: string;
  customerName: string;
  company: string;
  designation: string;
  interviewDate: string;
  majorPainPoints: string;
  dataSecurityConcerns: string;
  productFeedback: string;
  willingnessToPay: number;
  pricingFeedback: string;
  productImprovementSuggestions: string;
  validationStatus: FeedbackValidationStatus;
  securityTrustValidated: boolean;
  willingToPay25kValidated: boolean;
  timeSavedHoursWeekly: number;
}

export interface FinancialReportRecord {
  id: string;
  title: string;
  periodType: ReportPeriodType;
  periodLabel: string;
  generatedDate: string;
  generatedById: string;
  totalRevenue: number;
  totalExpenses: number;
  operatingSurplus: number;
  activeCustomers: number;
  contributionMarginPct: number;
  summaryNotes: string;
}

export interface VentureAssumptions {
  sellingPriceMonthly: number;
  variableCostPerCustomer: number;
  expectedBaseCustomers: number;
  monthlyFixedCost: number;
  planPricing: {
    conservative: number;
    standard: number;
    premium: number;
  };
  market: {
    tam: number;
    sam: number;
    som: number;
    potentialCustomers: number;
    serviceableCustomers: number;
    obtainableCustomers: number;
    annualSpendPerCustomer: number;
  };
  automationThresholds: {
    renewalReminderDays: number;
    emailOpenRateTarget: number;
    responseRateTarget: number;
  };
}

export interface WorkflowNotification {
  id: string;
  type:
    | 'New Customer'
    | 'Renewal Reminder'
    | 'Overdue Payment'
    | 'Sales Follow-up'
    | 'Task Deadline'
    | 'Financial Summary'
    | 'Campaign Alert';
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  message: string;
  relatedId: string;
  module: string;
  createdAt: string;
  read: boolean;
}

export interface ApexDatabase {
  users: UserRecord[];
  customers: CustomerRecord[];
  leads: LeadRecord[];
  subscriptions: SubscriptionRecord[];
  revenueTransactions: RevenueTransaction[];
  expenseTransactions: ExpenseTransaction[];
  marketingCampaigns: MarketingCampaign[];
  validationTasks: ValidationTask[];
  customerFeedback: CustomerFeedbackRecord[];
  financialReports: FinancialReportRecord[];
  assumptions: VentureAssumptions;
  notifications: WorkflowNotification[];
}

export type ModuleKey =
  | 'dashboard'
  | 'customers'
  | 'pipeline'
  | 'subscriptions'
  | 'financials'
  | 'analytics'
  | 'marketing'
  | 'validation'
  | 'market'
  | 'reports'
  | 'settings';
