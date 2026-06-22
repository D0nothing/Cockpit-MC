export const ticketStatuses = [
  'imported', 'assigned', 'context_ready', 'spec_generating',
  'spec_review_required', 'spec_validated', 'second_validation_required',
  'ready_for_ai', 'ai_requested', 'ai_running', 'branch_created',
  'pr_draft_created', 'ci_running', 'human_review_required', 'done',
  'blocked', 'rejected',
] as const;

export type TicketStatus = (typeof ticketStatuses)[number];
export type RiskLevel = 'standard' | 'sensitive' | 'critical';
export type TreatmentMode = 'manual' | 'ai_analysis' | 'codex';

export interface TicketSummary {
  id: string;
  externalId: number;
  title: string;
  description: string;
  status: TicketStatus;
  riskLevel: RiskLevel;
  labels: string[];
  repository: string;
  assignee?: { id: string; name: string } | null;
  updatedAt: string;
}

export const allowedTransitions: Record<TicketStatus, readonly TicketStatus[]> = {
  imported: ['assigned', 'blocked', 'rejected'],
  assigned: ['context_ready', 'blocked', 'rejected'],
  context_ready: ['spec_generating', 'blocked'],
  spec_generating: ['spec_review_required', 'blocked'],
  spec_review_required: ['spec_validated', 'rejected', 'blocked'],
  spec_validated: ['second_validation_required', 'ready_for_ai', 'blocked'],
  second_validation_required: ['ready_for_ai', 'rejected', 'blocked'],
  ready_for_ai: ['ai_requested', 'human_review_required', 'blocked'],
  ai_requested: ['ai_running', 'blocked'],
  ai_running: ['branch_created', 'blocked'],
  branch_created: ['pr_draft_created', 'blocked'],
  pr_draft_created: ['ci_running', 'human_review_required', 'blocked'],
  ci_running: ['human_review_required', 'blocked'],
  human_review_required: ['done', 'blocked', 'rejected'],
  done: [], blocked: ['assigned', 'context_ready', 'ready_for_ai', 'rejected'], rejected: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return allowedTransitions[from].includes(to);
}
