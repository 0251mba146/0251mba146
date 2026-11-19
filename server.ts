import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ModuleKey, UserRole } from './src/shared/types.ts';
import { canEditModule, computePlatformMetrics } from './src/shared/financialUtils.ts';
import {
  convertLeadToCustomer,
  createCustomerRecord,
  generateFinancialReport,
  loadDatabase,
  nextId,
  pushNotification,
  resetDatabaseToDemo,
  runAutomationSweep,
  saveDatabase,
} from './src/server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

function getRoleFromReq(req: express.Request): UserRole {
  const roleHeader = String(req.header('x-user-role') || 'ADMIN').toUpperCase();
  if (
    roleHeader === 'ADMIN' ||
    roleHeader === 'FINANCE_MANAGER' ||
    roleHeader === 'SALES_MANAGER' ||
    roleHeader === 'EXECUTIVE'
  ) {
    return roleHeader;
  }
  return 'EXECUTIVE';
}

function requireModuleWrite(moduleKey: ModuleKey) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = getRoleFromReq(req);
    if (!canEditModule(role, moduleKey)) {
      res.status(403).json({
        error: `Access denied for role ${role}: write permission on '${moduleKey}' is restricted.`,
      });
      return;
    }
    next();
  };
}

// Bootstrap full state + computed metrics
app.get('/api/bootstrap', (_req, res) => {
  const db = loadDatabase();
  const metrics = computePlatformMetrics(db);
  res.json({ db, metrics });
});

// Customers CRUD
app.post('/api/customers', requireModuleWrite('customers'), (req, res) => {
  const db = loadDatabase();
  const result = createCustomerRecord(db, req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json({ customer: result.customer, db, metrics: computePlatformMetrics(db) });
});

app.put('/api/customers/:id', requireModuleWrite('customers'), (req, res) => {
  const db = loadDatabase();
  const idx = db.customers.findIndex((c) => c.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }
  const emailNorm = String(req.body.email ?? db.customers[idx].email).trim().toLowerCase();
  const dup = db.customers.find(
    (c, i) => i !== idx && c.email.trim().toLowerCase() === emailNorm
  );
  if (dup) {
    res.status(400).json({ error: `Email already belongs to customer ${dup.id} (${dup.companyName}).` });
    return;
  }
  db.customers[idx] = { ...db.customers[idx], ...req.body, id: db.customers[idx].id };
  saveDatabase(db);
  res.json({ customer: db.customers[idx], db, metrics: computePlatformMetrics(db) });
});

app.delete('/api/customers/:id', requireModuleWrite('customers'), (req, res) => {
  const db = loadDatabase();
  db.customers = db.customers.filter((c) => c.id !== req.params.id);
  saveDatabase(db);
  res.json({ db, metrics: computePlatformMetrics(db) });
});

// Leads CRUD + Convert
app.post('/api/leads', requireModuleWrite('pipeline'), (req, res) => {
  const db = loadDatabase();
  const lead = {
    ...req.body,
    id: nextId('LEAD', db.leads.map((l) => l.id)),
  };
  db.leads.unshift(lead);
  saveDatabase(db);
  res.status(201).json({ lead, db, metrics: computePlatformMetrics(db) });
});

app.put('/api/leads/:id', requireModuleWrite('pipeline'), (req, res) => {
  const db = loadDatabase();
  const idx = db.leads.findIndex((l) => l.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  db.leads[idx] = { ...db.leads[idx], ...req.body, id: db.leads[idx].id };
  saveDatabase(db);
  res.json({ lead: db.leads[idx], db, metrics: computePlatformMetrics(db) });
});

app.post('/api/leads/:id/convert', requireModuleWrite('pipeline'), (req, res) => {
  const db = loadDatabase();
  const result = convertLeadToCustomer(db, String(req.params.id));
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ...result, db, metrics: computePlatformMetrics(db) });
});

app.delete('/api/leads/:id', requireModuleWrite('pipeline'), (req, res) => {
  const db = loadDatabase();
  db.leads = db.leads.filter((l) => l.id !== req.params.id);
  saveDatabase(db);
  res.json({ db, metrics: computePlatformMetrics(db) });
});

// Subscriptions CRUD
app.post('/api/subscriptions', requireModuleWrite('subscriptions'), (req, res) => {
  const db = loadDatabase();
  const customer = db.customers.find((c) => c.id === req.body.customerId);
  if (!customer) {
    res.status(400).json({ error: 'Valid Customer ID reference is required.' });
    return;
  }
  const sub = {
    ...req.body,
    id: nextId('SUB', db.subscriptions.map((s) => s.id)),
  };
  db.subscriptions.unshift(sub);
  if (sub.paymentStatus === 'Overdue') {
    pushNotification(db, {
      type: 'Overdue Payment',
      severity: 'critical',
      title: `Overdue Subscription Created: ${customer.companyName}`,
      message: `${sub.id} flagged as Overdue (₹${Number(sub.subscriptionAmount).toLocaleString('en-IN')}).`,
      relatedId: sub.id,
      module: 'subscriptions',
    });
  }
  saveDatabase(db);
  res.status(201).json({ subscription: sub, db, metrics: computePlatformMetrics(db) });
});

app.put('/api/subscriptions/:id', requireModuleWrite('subscriptions'), (req, res) => {
  const db = loadDatabase();
  const idx = db.subscriptions.findIndex((s) => s.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }
  const prevStatus = db.subscriptions[idx].paymentStatus;
  db.subscriptions[idx] = { ...db.subscriptions[idx], ...req.body, id: db.subscriptions[idx].id };
  if (prevStatus !== 'Overdue' && db.subscriptions[idx].paymentStatus === 'Overdue') {
    const customer = db.customers.find((c) => c.id === db.subscriptions[idx].customerId);
    pushNotification(db, {
      type: 'Overdue Payment',
      severity: 'critical',
      title: `Payment Marked Overdue: ${customer?.companyName ?? db.subscriptions[idx].customerId}`,
      message: `Subscription ${db.subscriptions[idx].id} requires payment collection follow-up.`,
      relatedId: db.subscriptions[idx].id,
      module: 'subscriptions',
    });
  }
  saveDatabase(db);
  res.json({ subscription: db.subscriptions[idx], db, metrics: computePlatformMetrics(db) });
});

app.delete('/api/subscriptions/:id', requireModuleWrite('subscriptions'), (req, res) => {
  const db = loadDatabase();
  db.subscriptions = db.subscriptions.filter((s) => s.id !== req.params.id);
  saveDatabase(db);
  res.json({ db, metrics: computePlatformMetrics(db) });
});

// Revenue Transactions CRUD
app.post('/api/revenue', requireModuleWrite('financials'), (req, res) => {
  const db = loadDatabase();
  const rev = {
    ...req.body,
    id: nextId('REV', db.revenueTransactions.map((r) => r.id)),
  };
  db.revenueTransactions.unshift(rev);
  saveDatabase(db);
  res.status(201).json({ transaction: rev, db, metrics: computePlatformMetrics(db) });
});

app.put('/api/revenue/:id', requireModuleWrite('financials'), (req, res) => {
  const db = loadDatabase();
  const idx = db.revenueTransactions.findIndex((r) => r.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Revenue transaction not found' });
    return;
  }
  db.revenueTransactions[idx] = { ...db.revenueTransactions[idx], ...req.body, id: db.revenueTransactions[idx].id };
  saveDatabase(db);
  res.json({ transaction: db.revenueTransactions[idx], db, metrics: computePlatformMetrics(db) });
});

app.delete('/api/revenue/:id', requireModuleWrite('financials'), (req, res) => {
  const db = loadDatabase();
  db.revenueTransactions = db.revenueTransactions.filter((r) => r.id !== req.params.id);
  saveDatabase(db);
  res.json({ db, metrics: computePlatformMetrics(db) });
});

// Expense Transactions CRUD
app.post('/api/expenses', requireModuleWrite('financials'), (req, res) => {
  const db = loadDatabase();
  const exp = {
    ...req.body,
    id: nextId('EXP', db.expenseTransactions.map((e) => e.id)),
  };
  db.expenseTransactions.unshift(exp);
  saveDatabase(db);
  res.status(201).json({ transaction: exp, db, metrics: computePlatformMetrics(db) });
});

app.put('/api/expenses/:id', requireModuleWrite('financials'), (req, res) => {
  const db = loadDatabase();
  const idx = db.expenseTransactions.findIndex((e) => e.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Expense transaction not found' });
    return;
  }
  db.expenseTransactions[idx] = { ...db.expenseTransactions[idx], ...req.body, id: db.expenseTransactions[idx].id };
  saveDatabase(db);
  res.json({ transaction: db.expenseTransactions[idx], db, metrics: computePlatformMetrics(db) });
});

app.delete('/api/expenses/:id', requireModuleWrite('financials'), (req, res) => {
  const db = loadDatabase();
  db.expenseTransactions = db.expenseTransactions.filter((e) => e.id !== req.params.id);
  saveDatabase(db);
  res.json({ db, metrics: computePlatformMetrics(db) });
});

// Marketing Campaigns CRUD
app.post('/api/campaigns', requireModuleWrite('marketing'), (req, res) => {
  const db = loadDatabase();
  const cmp = {
    ...req.body,
    id: nextId('CMP', db.marketingCampaigns.map((c) => c.id)),
  };
  db.marketingCampaigns.unshift(cmp);
  saveDatabase(db);
  res.status(201).json({ campaign: cmp, db, metrics: computePlatformMetrics(db) });
});

app.put('/api/campaigns/:id', requireModuleWrite('marketing'), (req, res) => {
  const db = loadDatabase();
  const idx = db.marketingCampaigns.findIndex((c) => c.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }
  db.marketingCampaigns[idx] = { ...db.marketingCampaigns[idx], ...req.body, id: db.marketingCampaigns[idx].id };
  saveDatabase(db);
  res.json({ campaign: db.marketingCampaigns[idx], db, metrics: computePlatformMetrics(db) });
});

app.delete('/api/campaigns/:id', requireModuleWrite('marketing'), (req, res) => {
  const db = loadDatabase();
  db.marketingCampaigns = db.marketingCampaigns.filter((c) => c.id !== req.params.id);
  saveDatabase(db);
  res.json({ db, metrics: computePlatformMetrics(db) });
});

// Validation Tasks CRUD
app.post('/api/validation-tasks', requireModuleWrite('validation'), (req, res) => {
  const db = loadDatabase();
  const task = {
    ...req.body,
    id: nextId('VAL', db.validationTasks.map((t) => t.id)),
  };
  db.validationTasks.push(task);
  saveDatabase(db);
  res.status(201).json({ task, db, metrics: computePlatformMetrics(db) });
});

app.put('/api/validation-tasks/:id', requireModuleWrite('validation'), (req, res) => {
  const db = loadDatabase();
  const idx = db.validationTasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  db.validationTasks[idx] = { ...db.validationTasks[idx], ...req.body, id: db.validationTasks[idx].id };
  saveDatabase(db);
  res.json({ task: db.validationTasks[idx], db, metrics: computePlatformMetrics(db) });
});

app.delete('/api/validation-tasks/:id', requireModuleWrite('validation'), (req, res) => {
  const db = loadDatabase();
  db.validationTasks = db.validationTasks.filter((t) => t.id !== req.params.id);
  saveDatabase(db);
  res.json({ db, metrics: computePlatformMetrics(db) });
});

// Customer Feedback / Interviews CRUD
app.post('/api/feedback', requireModuleWrite('validation'), (req, res) => {
  const db = loadDatabase();
  const fb = {
    ...req.body,
    id: nextId('INT', db.customerFeedback.map((f) => f.id)),
  };
  db.customerFeedback.unshift(fb);
  saveDatabase(db);
  res.status(201).json({ feedback: fb, db, metrics: computePlatformMetrics(db) });
});

app.put('/api/feedback/:id', requireModuleWrite('validation'), (req, res) => {
  const db = loadDatabase();
  const idx = db.customerFeedback.findIndex((f) => f.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Interview record not found' });
    return;
  }
  db.customerFeedback[idx] = { ...db.customerFeedback[idx], ...req.body, id: db.customerFeedback[idx].id };
  saveDatabase(db);
  res.json({ feedback: db.customerFeedback[idx], db, metrics: computePlatformMetrics(db) });
});

app.delete('/api/feedback/:id', requireModuleWrite('validation'), (req, res) => {
  const db = loadDatabase();
  db.customerFeedback = db.customerFeedback.filter((f) => f.id !== req.params.id);
  saveDatabase(db);
  res.json({ db, metrics: computePlatformMetrics(db) });
});

// Financial Reports Generation
app.post('/api/reports/generate', requireModuleWrite('reports'), (req, res) => {
  const db = loadDatabase();
  const report = generateFinancialReport(db, req.body);
  res.status(201).json({ report, db, metrics: computePlatformMetrics(db) });
});

// Settings: Venture Assumptions & Users
app.put('/api/assumptions', requireModuleWrite('settings'), (req, res) => {
  const db = loadDatabase();
  db.assumptions = {
    ...db.assumptions,
    ...req.body,
    planPricing: {
      ...db.assumptions.planPricing,
      ...(req.body.planPricing || {}),
    },
    market: {
      ...db.assumptions.market,
      ...(req.body.market || {}),
    },
    automationThresholds: {
      ...db.assumptions.automationThresholds,
      ...(req.body.automationThresholds || {}),
    },
  };
  saveDatabase(db);
  res.json({ assumptions: db.assumptions, db, metrics: computePlatformMetrics(db) });
});

app.post('/api/users', requireModuleWrite('settings'), (req, res) => {
  const db = loadDatabase();
  const user = {
    ...req.body,
    id: nextId('USR', db.users.map((u) => u.id)),
    avatarUrl:
      req.body.avatarUrl || '/src/assets/images/avatar_finance_manager_1795092329051.jpg',
    lastLogin: new Date().toISOString(),
  };
  db.users.push(user);
  saveDatabase(db);
  res.status(201).json({ user, db, metrics: computePlatformMetrics(db) });
});

app.put('/api/users/:id', requireModuleWrite('settings'), (req, res) => {
  const db = loadDatabase();
  const idx = db.users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  db.users[idx] = { ...db.users[idx], ...req.body, id: db.users[idx].id };
  saveDatabase(db);
  res.json({ user: db.users[idx], db, metrics: computePlatformMetrics(db) });
});

// Automation & Notifications
app.post('/api/automation/run', (_req, res) => {
  const db = loadDatabase();
  const result = runAutomationSweep(db);
  res.json({ ...result, db, metrics: computePlatformMetrics(db) });
});

app.post('/api/notifications/:id/read', (req, res) => {
  const db = loadDatabase();
  const n = db.notifications.find((item) => item.id === req.params.id);
  if (n) {
    n.read = true;
    saveDatabase(db);
  }
  res.json({ db });
});

app.post('/api/notifications/read-all', (_req, res) => {
  const db = loadDatabase();
  for (const n of db.notifications) n.read = true;
  saveDatabase(db);
  res.json({ db });
});

app.post('/api/reset-demo', requireModuleWrite('settings'), (_req, res) => {
  const db = resetDatabaseToDemo();
  res.json({ db, metrics: computePlatformMetrics(db) });
});

async function startServer() {
  const port = Number(process.env.PORT) || 3000;
  const distDir = path.resolve(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Apex Tech server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
