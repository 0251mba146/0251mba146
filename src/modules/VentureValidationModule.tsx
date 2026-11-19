import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import type {
  ApexDatabase,
  CustomerFeedbackRecord,
  UserRole,
  ValidationStatus,
  ValidationTask,
} from '../shared/types.ts';
import { canEditModule, formatINR, formatPct, ROLE_PERMISSIONS } from '../shared/financialUtils.ts';
import { KpiCard, Modal, ReadOnlyBanner, SectionHeader, SemanticStatus } from '../components/UiPrimitives.tsx';

export function VentureValidationModule({
  db,
  role,
  onMutate,
}: {
  db: ApexDatabase;
  role: UserRole;
  onMutate: (method: string, url: string, body?: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const editable = canEditModule(role, 'validation');
  const [subTab, setSubTab] = useState<'tracker' | 'feedback'>('tracker');
  const [taskModal, setTaskModal] = useState(false);
  const [fbModal, setFbModal] = useState(false);

  const [taskForm, setTaskForm] = useState<Omit<ValidationTask, 'id'>>({
    week: 'Week 4',
    taskDescription: '',
    assignedPersonId: db.users[0]?.id ?? 'USR-001',
    startDate: '2026-11-19',
    dueDate: '2026-11-26',
    target: 10,
    targetUnit: 'interviews',
    actualAchievement: 0,
    status: 'In Progress',
    performanceRemarks: '',
  });

  const [fbForm, setFbForm] = useState<Omit<CustomerFeedbackRecord, 'id'>>({
    customerName: '',
    company: '',
    designation: 'Chief Financial Officer',
    interviewDate: '2026-11-19',
    majorPainPoints: '',
    dataSecurityConcerns: '',
    productFeedback: '',
    willingnessToPay: 25000,
    pricingFeedback: '',
    productImprovementSuggestions: '',
    validationStatus: 'Validated',
    securityTrustValidated: true,
    willingToPay25kValidated: true,
    timeSavedHoursWeekly: 18,
  });

  const overdueTasks = db.validationTasks.filter((t) => t.status === 'Overdue');
  const overallCompletion =
    db.validationTasks.length > 0
      ? db.validationTasks.reduce(
          (sum, t) => sum + Math.min(100, (t.actualAchievement / Math.max(t.target, 1)) * 100),
          0
        ) / db.validationTasks.length
      : 0;

  // 3 Major Venture Assumptions Metrics (Module 10)
  const totalInterviews = Math.max(db.customerFeedback.length, 1);
  const securityValidatedCount = db.customerFeedback.filter((f) => f.securityTrustValidated).length;
  const wtpValidatedCount = db.customerFeedback.filter((f) => f.willingToPay25kValidated).length;
  const avgHoursSaved =
    db.customerFeedback.reduce((s, f) => s + f.timeSavedHoursWeekly, 0) / totalInterviews;

  const getUserName = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;

  async function saveTask(e: React.FormEvent) {
    e.preventDefault();
    const res = await onMutate('POST', '/api/validation-tasks', taskForm);
    if (res.ok) setTaskModal(false);
  }

  async function saveFeedback(e: React.FormEvent) {
    e.preventDefault();
    const res = await onMutate('POST', '/api/feedback', fbForm);
    if (res.ok) setFbModal(false);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="30-Day Venture Validation & Customer Discovery"
        subtitle="4-week execution milestones and validation of security trust, ₹25,000 WTP, and 15–20 hrs/wk reporting savings · DEMO DATA"
        actions={
          editable ? (
            <button
              type="button"
              onClick={() => (subTab === 'tracker' ? setTaskModal(true) : setFbModal(true))}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md hover:bg-[#132844] whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              {subTab === 'tracker' ? 'Add Validation Task' : 'Log Interview Feedback'}
            </button>
          ) : null
        }
      />

      {!editable && <ReadOnlyBanner roleLabel={ROLE_PERMISSIONS[role].label} />}

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setSubTab('tracker')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            subTab === 'tracker' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          30-Day Validation Tracker (Weeks 1–4)
        </button>
        <button
          type="button"
          onClick={() => setSubTab('feedback')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            subTab === 'feedback' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Customer Interviews & Hypothesis Proof ({db.customerFeedback.length})
        </button>
      </div>

      {subTab === 'tracker' && (
        <div className="space-y-6">
          {overdueTasks.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-xs text-red-800">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Overdue Validation Alert ({overdueTasks.length} task)</div>
                <div className="mt-0.5">
                  {overdueTasks.map((t) => `${t.id} (${t.week}: due ${t.dueDate})`).join(', ')} — requires immediate completion.
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Overall 30-Day Progress" value={formatPct(overallCompletion)} subtext={`${db.validationTasks.filter((t) => t.status === 'Completed').length} of ${db.validationTasks.length} tasks completed`} highlight="accent" />
            <KpiCard label="Week 1: Prospect DB" value="214 / 200" subtext="CFO & Controller profiles verified" highlight="positive" />
            <KpiCard label="Week 2: Outbound Metrics" value="51.8% Open · 10.7% Reply" subtext="Targets: >45% open, >8% response" highlight="positive" />
            <KpiCard label="Week 3–4: Demos & Pilots" value="10 Demos · 3 Paid Pilots" subtext="Validated ₹25,000/month pricing" highlight="positive" />
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 text-left font-medium">Task</th>
                    <th className="py-3 px-4 text-left font-medium">Week</th>
                    <th className="py-3 px-4 text-left font-medium">Owner</th>
                    <th className="py-3 px-4 text-left font-medium">Window</th>
                    <th className="py-3 px-4 text-right font-medium">Actual / Target</th>
                    <th className="py-3 px-4 text-left font-medium w-44">Completion</th>
                    <th className="py-3 px-4 text-left font-medium">Status</th>
                    {editable && <th className="py-3 px-4 text-right font-medium">Update</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {db.validationTasks.map((task) => {
                    const pct = Math.min(100, (task.actualAchievement / Math.max(task.target, 1)) * 100);
                    return (
                      <tr key={task.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 max-w-sm">
                          <div className="font-medium text-slate-900">
                            <span className="font-mono text-slate-400 mr-1.5">{task.id}</span>
                            {task.taskDescription}
                          </div>
                          <div className="text-slate-500 mt-0.5">{task.performanceRemarks}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">{task.week}</td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{getUserName(task.assignedPersonId)}</td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {task.startDate} → {task.dueDate}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                          {task.actualAchievement} / {task.target} <span className="text-slate-400">{task.targetUnit}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-sm overflow-hidden">
                              <div
                                className={`h-full ${
                                  task.status === 'Overdue'
                                    ? 'bg-red-600'
                                    : pct >= 100
                                    ? 'bg-emerald-600'
                                    : 'bg-blue-700'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono tabular-nums text-[11px] text-slate-600 w-10 text-right">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <SemanticStatus status={task.status} />
                        </td>
                        {editable && (
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {task.status !== 'Completed' && (
                              <button
                                type="button"
                                onClick={() =>
                                  onMutate('PUT', `/api/validation-tasks/${task.id}`, {
                                    actualAchievement: task.target,
                                    status: 'Completed',
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-50"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Complete
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'feedback' && (
        <div className="space-y-6">
          {/* 3 Venture Hypotheses Validation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
              <div className="text-xs font-medium text-slate-500">Hypothesis 1 · Data Security Trust</div>
              <div className="text-2xl font-mono tabular-nums font-semibold text-slate-900">
                {securityValidatedCount} / {db.customerFeedback.length} ({((securityValidatedCount / totalInterviews) * 100).toFixed(0)}%)
              </div>
              <p className="text-xs text-slate-600">
                CFOs & controllers validating encryption, RBAC, and India data residency controls.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
              <div className="text-xs font-medium text-slate-500">Hypothesis 2 · Willingness to Pay ₹25,000/mo</div>
              <div className="text-2xl font-mono tabular-nums font-semibold text-emerald-700">
                {wtpValidatedCount} / {db.customerFeedback.length} ({((wtpValidatedCount / totalInterviews) * 100).toFixed(0)}%)
              </div>
              <p className="text-xs text-slate-600">
                Interviewees confirming ≥ ₹25,000 monthly budget approval (avg WTP {formatINR(db.customerFeedback.reduce((s, f) => s + f.willingnessToPay, 0) / totalInterviews)}).
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
              <div className="text-xs font-medium text-slate-500">Hypothesis 3 · Reporting Time Reduction</div>
              <div className="text-2xl font-mono tabular-nums font-semibold text-blue-700">
                {avgHoursSaved.toFixed(1)} hrs / week
              </div>
              <p className="text-xs text-slate-600">
                Target benchmark: 15–20 hours/week reduction in manual Excel & MIS reconciliation.
              </p>
            </div>
          </div>

          {/* Interviews Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 text-left font-medium">Interview</th>
                    <th className="py-3 px-4 text-left font-medium">Decision Maker</th>
                    <th className="py-3 px-4 text-left font-medium">Pain Points & Feedback</th>
                    <th className="py-3 px-4 text-left font-medium">Security Concerns</th>
                    <th className="py-3 px-4 text-right font-medium">WTP / Mo</th>
                    <th className="py-3 px-4 text-right font-medium">Hrs Saved/Wk</th>
                    <th className="py-3 px-4 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {db.customerFeedback.map((fb) => (
                    <tr key={fb.id} className="hover:bg-slate-50 align-top">
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        <div>{fb.id}</div>
                        <div className="text-[11px]">{fb.interviewDate}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{fb.customerName}</div>
                        <div className="text-slate-600">{fb.designation}</div>
                        <div className="text-slate-400">{fb.company}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs space-y-1">
                        <div className="text-slate-800">{fb.majorPainPoints}</div>
                        <div className="text-slate-500">Feedback: {fb.productFeedback}</div>
                        <div className="text-blue-700">Request: {fb.productImprovementSuggestions}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs text-slate-600">
                        <div>{fb.dataSecurityConcerns}</div>
                        <div className="mt-1 font-medium text-slate-800">
                          Security Trust: {fb.securityTrustValidated ? 'Validated' : 'Pending Review'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{formatINR(fb.willingnessToPay)}</div>
                        <div className="text-[11px] text-slate-500">{fb.willingToPay25kValidated ? '≥ ₹25k Confirmed' : 'Below ₹25k'}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-blue-700 whitespace-nowrap">
                        {fb.timeSavedHoursWeekly} hrs
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <SemanticStatus status={fb.validationStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Validation Task Modal */}
      <Modal open={taskModal} onClose={() => setTaskModal(false)} title="Add 30-Day Validation Task">
        <form onSubmit={saveTask} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Week</label>
              <select
                value={taskForm.week}
                onChange={(e) => setTaskForm({ ...taskForm, week: e.target.value as ValidationTask['week'] })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option>Week 1</option>
                <option>Week 2</option>
                <option>Week 3</option>
                <option>Week 4</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Assigned Owner</label>
              <select
                value={taskForm.assignedPersonId}
                onChange={(e) => setTaskForm({ ...taskForm, assignedPersonId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Task Description *</label>
              <input
                required
                value={taskForm.taskDescription}
                onChange={(e) => setTaskForm({ ...taskForm, taskDescription: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Target Value</label>
              <input
                type="number"
                min={1}
                value={taskForm.target}
                onChange={(e) => setTaskForm({ ...taskForm, target: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Target Unit</label>
              <input
                value={taskForm.targetUnit}
                onChange={(e) => setTaskForm({ ...taskForm, targetUnit: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Actual Achievement</label>
              <input
                type="number"
                min={0}
                value={taskForm.actualAchievement}
                onChange={(e) => setTaskForm({ ...taskForm, actualAchievement: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setTaskModal(false)} className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md">
              Save Task
            </button>
          </div>
        </form>
      </Modal>

      {/* Log Feedback Modal */}
      <Modal open={fbModal} onClose={() => setFbModal(false)} title="Log Customer Validation Interview">
        <form onSubmit={saveFeedback} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Customer Name *</label>
              <input required value={fbForm.customerName} onChange={(e) => setFbForm({ ...fbForm, customerName: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Company *</label>
              <input required value={fbForm.company} onChange={(e) => setFbForm({ ...fbForm, company: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Designation</label>
              <input value={fbForm.designation} onChange={(e) => setFbForm({ ...fbForm, designation: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Willingness to Pay (₹/mo)</label>
              <input type="number" min={0} value={fbForm.willingnessToPay} onChange={(e) => setFbForm({ ...fbForm, willingnessToPay: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono" />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Hours Saved Weekly</label>
              <input type="number" min={0} max={40} value={fbForm.timeSavedHoursWeekly} onChange={(e) => setFbForm({ ...fbForm, timeSavedHoursWeekly: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono" />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Validation Status</label>
              <select value={fbForm.validationStatus} onChange={(e) => setFbForm({ ...fbForm, validationStatus: e.target.value as CustomerFeedbackRecord['validationStatus'] })} className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white">
                <option>Validated</option>
                <option>Conditional</option>
                <option>Needs Follow-up</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Major Pain Points *</label>
            <textarea required rows={2} value={fbForm.majorPainPoints} onChange={(e) => setFbForm({ ...fbForm, majorPainPoints: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md" />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Data Security Concerns</label>
            <input value={fbForm.dataSecurityConcerns} onChange={(e) => setFbForm({ ...fbForm, dataSecurityConcerns: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md" />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Product Feedback</label>
            <input value={fbForm.productFeedback} onChange={(e) => setFbForm({ ...fbForm, productFeedback: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md" />
          </div>
          <div className="flex items-center gap-4 pt-1">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={fbForm.securityTrustValidated} onChange={(e) => setFbForm({ ...fbForm, securityTrustValidated: e.target.checked })} />
              <span>Security Trust Validated</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={fbForm.willingToPay25kValidated} onChange={(e) => setFbForm({ ...fbForm, willingToPay25kValidated: e.target.checked })} />
              <span>₹25,000 WTP Validated</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setFbModal(false)} className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md">
              Save Interview
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
