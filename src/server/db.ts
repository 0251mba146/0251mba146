import fs from 'node:fs';
import path from 'node:path';
import type {
  ApexDatabase,
  CustomerRecord,
  LeadRecord,
  SubscriptionRecord,
  RevenueTransaction,
  ExpenseTransaction,
  MarketingCampaign,
  ValidationTask,
  CustomerFeedbackRecord,
  FinancialReportRecord,
  UserRecord,
  VentureAssumptions,
  WorkflowNotification,
} from '../shared/types.ts';
import { computePlatformMetrics, getPlanPrice } from '../shared/financialUtils.ts';
import { createSeedDatabase } from './seedData.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'apex-db.json');

let memoryDb: ApexDatabase | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadDatabase(): ApexDatabase {
  if (memoryDb) return memoryDb;
  ensureDataDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      memoryDb = JSON.parse(raw) as ApexDatabase;
      return memoryDb;
    } catch {
      // fallback to fresh seed if corrupted
    }
  }
  memoryDb = createSeedDatabase();
  saveDatabase(memoryDb);
  return memoryDb;
}

export function saveDatabase(db: ApexDatabase): void {
  memoryDb = db;
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

export function resetDatabaseToDemo(): ApexDatabase {
  const fresh = createSeedDatabase();
  saveDatabase(fresh);
  return fresh;
}

export function nextId(prefix: string, existingIds: string[]): string {
  let max = 0;
  for (const id of existingIds) {
    const match = id.match(/(\d+)$/);
    if (match) {
      const n = Number(match[1]);
      if (n > max) max = n;
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export function pushNotification(
  db: ApexDatabase,
  payload: Omit<WorkflowNotification, 'id' | 'createdAt' | 'read'>
): WorkflowNotification {
  const notif: WorkflowNotification = {
    id: nextId('NTF', db.notifications.map((n) => n.id)),
    createdAt: new Date().toISOString(),
    read: false,
    ...payload,
  };
  db.notifications.unshift(notif);
  if (db.notifications.length > 50) {
    db.notifications = db.notifications.slice(0, 50);
  }
  return notif;
}

export function runAutomationSweep(db: ApexDatabase): { createdCount: number; notifications: WorkflowNotification[] } {
  const today = '2026-11-19';
  const created: WorkflowNotification[] = [];
  const existingKeys = new Set(db.notifications.map((n) => `${n.type}:${n.relatedId}`));

  // 1. Overdue payment alerts
  for (const sub of db.subscriptions) {
    if (sub.paymentStatus === 'Overdue') {
      const key = `Overdue Payment:${sub.id}`;
      if (!existingKeys.has(key)) {
        const cust = db.customers.find((c) => c.id === sub.customerId);
        created.push(
          pushNotification(db, {
            type: 'Overdue Payment',
            severity: 'critical',
            title: `Overdue Payment: ${cust?.companyName ?? sub.customerId}`,
            message: `Subscription ${sub.id} (${sub.planName}) has an overdue balance of ₹${sub.subscriptionAmount.toLocaleString('en-IN')}.`,
            relatedId: sub.id,
            module: 'subscriptions',
          })
        );
      }
    }
  }

  // 2. Upcoming renewals within configured threshold days
  const reminderDays = db.assumptions.automationThresholds.renewalReminderDays;
  const todayMs = new Date(`${today}T00:00:00Z`).getTime();
  for (const sub of db.subscriptions) {
    if (sub.status === 'Cancelled') continue;
    const renMs = new Date(`${sub.renewalDate}T00:00:00Z`).getTime();
    const diffDays = Math.ceil((renMs - todayMs) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= reminderDays) {
      const key = `Renewal Reminder:${sub.id}`;
      if (!existingKeys.has(key)) {
        const cust = db.customers.find((c) => c.id === sub.customerId);
        created.push(
          pushNotification(db, {
            type: 'Renewal Reminder',
            severity: 'warning',
            title: `Upcoming Renewal (${diffDays}d): ${cust?.companyName ?? sub.customerId}`,
            message: `${sub.planName} renews on ${sub.renewalDate}. Verify payment method and expansion readiness.`,
            relatedId: sub.id,
            module: 'subscriptions',
          })
        );
      }
    }
  }

  // 3. Overdue or imminent validation tasks
  for (const task of db.validationTasks) {
    if (task.status !== 'Completed' && task.dueDate < today) {
      task.status = 'Overdue';
      const key = `Task Deadline:${task.id}`;
      if (!existingKeys.has(key)) {
        created.push(
          pushNotification(db, {
            type: 'Task Deadline',
            severity: 'critical',
            title: `Overdue Venture Task: ${task.id} (${task.week})`,
            message: `${task.taskDescription} was due ${task.dueDate} (${task.actualAchievement}/${task.target} ${task.targetUnit}).`,
            relatedId: task.id,
            module: 'validation',
          })
        );
      }
    }
  }

  // 4. Sales follow-up reminders within 2 days
  for (const lead of db.leads) {
    if (['Converted', 'Lost'].includes(lead.salesStage)) continue;
    const fMs = new Date(`${lead.followUpDate}T00:00:00Z`).getTime();
    const diffDays = Math.ceil((fMs - todayMs) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 2) {
      const key = `Sales Follow-up:${lead.id}`;
      if (!existingKeys.has(key)) {
        created.push(
          pushNotification(db, {
            type: 'Sales Follow-up',
            severity: 'info',
            title: `Follow-up Due: ${lead.companyName}`,
            message: `${lead.contactPerson} (${lead.salesStage}) follow-up scheduled for ${lead.followUpDate}.`,
            relatedId: lead.id,
            module: 'pipeline',
          })
        );
      }
    }
  }

  // 5. Campaign ROI monitoring
  for (const cmp of db.marketingCampaigns) {
    if (cmp.actualSpend > 0 && cmp.paidCustomers > 0) {
      const revenueGenerated = cmp.paidCustomers * db.assumptions.sellingPriceMonthly * 12;
      const roiPct = ((revenueGenerated - cmp.actualSpend) / cmp.actualSpend) * 100;
      if (roiPct >= 500) {
        const key = `Campaign Alert:${cmp.id}`;
        if (!existingKeys.has(key)) {
          created.push(
            pushNotification(db, {
              type: 'Campaign Alert',
              severity: 'success',
              title: `High-ROI Channel: ${cmp.channel}`,
              message: `${cmp.campaignName} achieved ${cmp.paidCustomers} paid conversions (${Math.round(roiPct)}% annualized ROI).`,
              relatedId: cmp.id,
              module: 'marketing',
            })
          );
        }
      }
    }
  }

  saveDatabase(db);
  return { createdCount: created.length, notifications: db.notifications };
}

export function createCustomerRecord(
  db: ApexDatabase,
  input: Omit<CustomerRecord, 'id'>
): { ok: true; customer: CustomerRecord } | { ok: false; error: string } {
  const emailNorm = input.email.trim().toLowerCase();
  const companyNorm = input.companyName.trim().toLowerCase();
  const duplicate = db.customers.find(
    (c) =>
      c.email.trim().toLowerCase() === emailNorm ||
      c.companyName.trim().toLowerCase() === companyNorm
  );
  if (duplicate) {
    return {
      ok: false,
      error: `Duplicate customer prevented: ${duplicate.companyName} (${duplicate.email}) already exists as ${duplicate.id}.`,
    };
  }

  const customer: CustomerRecord = {
    ...input,
    id: nextId('CUST', db.customers.map((c) => c.id)),
  };
  db.customers.unshift(customer);

  // Automatically create subscription & revenue record if Paid Customer
  if (customer.status === 'Paid Customer' || customer.status === 'Trial Customer') {
    const planPrice =
      customer.monthlySubscriptionValue > 0
        ? customer.monthlySubscriptionValue
        : getPlanPrice(customer.subscriptionPlan, db.assumptions.planPricing);
    const start = customer.acquisitionDate || '2026-11-19';
    const sub: SubscriptionRecord = {
      id: nextId('SUB', db.subscriptions.map((s) => s.id)),
      customerId: customer.id,
      planName: customer.subscriptionPlan,
      startDate: start,
      endDate: addMonthsIso(start, 12),
      billingFrequency: 'Monthly',
      subscriptionAmount: customer.status === 'Paid Customer' ? planPrice : 0,
      paymentStatus: customer.status === 'Paid Customer' ? 'Paid' : 'Pending',
      renewalDate: addMonthsIso(start, 1),
      status: customer.status === 'Paid Customer' ? 'Active' : 'Trial',
    };
    db.subscriptions.unshift(sub);

    if (customer.status === 'Paid Customer' && planPrice > 0) {
      const rev: RevenueTransaction = {
        id: nextId('REV', db.revenueTransactions.map((r) => r.id)),
        customerId: customer.id,
        subscriptionId: sub.id,
        category: 'Subscription Revenue',
        amount: planPrice,
        date: start,
        quarter: getQuarterFromDate(start),
        fiscalYear: 'FY26-27',
        paymentMethod: 'NEFT / Corporate Bank',
        status: 'Received',
        description: `Initial ${customer.subscriptionPlan} subscription — ${customer.companyName}`,
      };
      db.revenueTransactions.unshift(rev);
    }
  }

  pushNotification(db, {
    type: 'New Customer',
    severity: 'success',
    title: `New Customer Registered: ${customer.companyName}`,
    message: `${customer.contactPerson} (${customer.designation}, ${customer.city}) added as ${customer.status}.`,
    relatedId: customer.id,
    module: 'customers',
  });

  saveDatabase(db);
  return { ok: true, customer };
}

export function convertLeadToCustomer(
  db: ApexDatabase,
  leadId: string
): { ok: true; lead: LeadRecord; customer: CustomerRecord } | { ok: false; error: string } {
  const lead = db.leads.find((l) => l.id === leadId);
  if (!lead) return { ok: false, error: 'Lead not found.' };
  if (lead.convertedCustomerId) {
    const existing = db.customers.find((c) => c.id === lead.convertedCustomerId);
    if (existing) return { ok: false, error: `Lead already converted to ${existing.id}.` };
  }

  const created = createCustomerRecord(db, {
    companyName: lead.companyName,
    contactPerson: lead.contactPerson,
    designation: lead.jobDesignation,
    email: lead.email,
    phone: '+91 98000 00000',
    industry: 'B2B SaaS',
    companyRevenueRange: '₹50 Cr – ₹150 Cr',
    employeeCount: 140,
    city: 'Bengaluru',
    leadSource: lead.leadSource,
    acquisitionDate: '2026-11-19',
    subscriptionPlan:
      lead.expectedDealValue >= 350000
        ? 'Premium Plan'
        : lead.expectedDealValue <= 250000
        ? 'Conservative Plan'
        : 'Standard Plan',
    status: 'Paid Customer',
    monthlySubscriptionValue:
      lead.expectedDealValue >= 350000
        ? db.assumptions.planPricing.premium
        : lead.expectedDealValue <= 250000
        ? db.assumptions.planPricing.conservative
        : db.assumptions.planPricing.standard,
    assignedSalesExecutiveId: lead.assignedEmployeeId,
    nextFollowUpDate: '2026-12-19',
    remarks: `Converted from Pipeline Lead ${lead.id}. ${lead.notes}`,
  });

  if (!created.ok) return created;

  lead.salesStage = 'Converted';
  lead.demoStatus = 'Completed';
  lead.conversionProbability = 100;
  lead.convertedCustomerId = created.customer.id;
  saveDatabase(db);
  return { ok: true, lead, customer: created.customer };
}

export function generateFinancialReport(
  db: ApexDatabase,
  input: { periodType: 'Monthly' | 'Quarterly' | 'Annual'; periodLabel: string; generatedById: string; summaryNotes?: string }
): FinancialReportRecord {
  const metrics = computePlatformMetrics(db);
  const multiplier = input.periodType === 'Annual' ? 12 : input.periodType === 'Quarterly' ? 3 : 1;
  const totalRevenue =
    input.periodType === 'Monthly'
      ? metrics.live.currentMonthRevenue
      : Math.round(metrics.live.currentMonthRevenue * multiplier);
  const totalExpenses =
    input.periodType === 'Monthly'
      ? metrics.live.currentMonthExpenses
      : Math.round(metrics.live.currentMonthExpenses * multiplier);
  const operatingSurplus = totalRevenue - totalExpenses;

  const report: FinancialReportRecord = {
    id: nextId('RPT', db.financialReports.map((r) => r.id)),
    title: `${input.periodType} Executive Financial Report — ${input.periodLabel}`,
    periodType: input.periodType,
    periodLabel: input.periodLabel,
    generatedDate: '2026-11-19',
    generatedById: input.generatedById,
    totalRevenue,
    totalExpenses,
    operatingSurplus,
    activeCustomers: metrics.live.paidCustomers,
    contributionMarginPct: Number(metrics.live.contributionMarginPctActual.toFixed(1)),
    summaryNotes:
      input.summaryNotes?.trim() ||
      `Generated from live database tables: ${metrics.live.paidCustomers} paid customers, MRR ₹${metrics.live.mrr.toLocaleString('en-IN')}.`,
  };

  db.financialReports.unshift(report);
  pushNotification(db, {
    type: 'Financial Summary',
    severity: 'info',
    title: `Report Generated: ${report.periodLabel}`,
    message: `${report.title} saved with Operating Surplus ₹${report.operatingSurplus.toLocaleString('en-IN')}.`,
    relatedId: report.id,
    module: 'reports',
  });
  saveDatabase(db);
  return report;
}

function addMonthsIso(dateIso: string, months: number): string {
  const dt = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return '2026-12-19';
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return dt.toISOString().slice(0, 10);
}

function getQuarterFromDate(dateIso: string): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  const month = Number(dateIso.slice(5, 7));
  if (month >= 4 && month <= 6) return 'Q1';
  if (month >= 7 && month <= 9) return 'Q2';
  if (month >= 10 && month <= 12) return 'Q3';
  return 'Q4';
}

export type {
  UserRecord,
  CustomerRecord,
  LeadRecord,
  SubscriptionRecord,
  RevenueTransaction,
  ExpenseTransaction,
  MarketingCampaign,
  ValidationTask,
  CustomerFeedbackRecord,
  FinancialReportRecord,
  VentureAssumptions,
};
