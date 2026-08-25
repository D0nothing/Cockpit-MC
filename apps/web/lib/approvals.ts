import { apiRequest, array, choice, integer, object, string, strings, type SessionRiskLevel } from './data';

export type ApprovalResult = 'approved' | 'rejected' | 'changes_requested';

export interface ApprovalReadModel {
  id: string;
  projectId: string;
  sessionId: string;
  riskLevel: SessionRiskLevel;
  requiredApprovals: number;
  requesterId: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested' | 'expired';
  expiresAt: string;
  project: { id: string; name: string; slug: string };
  session: { id: string; objective: string; state: string };
  macroTask: { id: string; version: number; objective: string; acceptanceCriteria: string[] };
  decisions: Array<{ id: string; approverId: string; result: ApprovalResult; reason: string; decidedAt: string }>;
}

export async function getApprovals(projectId: string): Promise<ApprovalReadModel[]> {
  const value = await apiRequest(`/approvals?projectId=${encodeURIComponent(projectId)}`);
  if (!Array.isArray(value)) throw new Error('Approval list is invalid');
  return value.map(approvalReadModel);
}

export async function decideApproval(projectId: string, approvalId: string, approverId: string, result: ApprovalResult): Promise<ApprovalReadModel> {
  const value = await apiRequest(`/approvals/${encodeURIComponent(approvalId)}/decisions`, {
    method: 'POST',
    body: JSON.stringify({ projectId, approverId, result, reason: result === 'approved' ? 'Critères et risques vérifiés dans le cockpit.' : 'Corrections demandées depuis le cockpit.' }),
  });
  return approvalReadModel(value);
}

function approvalReadModel(value: unknown): ApprovalReadModel {
  const input = object(value, 'Approval');
  const project = object(input.project, 'Approval.project');
  const session = object(input.session, 'Approval.session');
  const macroTask = object(input.macroTask, 'Approval.macroTask');
  return {
    id: string(input.id, 'Approval.id'),
    projectId: string(input.projectId, 'Approval.projectId'),
    sessionId: string(input.sessionId, 'Approval.sessionId'),
    riskLevel: choice(input.riskLevel, 'Approval.riskLevel', ['standard', 'sensitive', 'critical']),
    requiredApprovals: integer(input.requiredApprovals, 'Approval.requiredApprovals'),
    requesterId: string(input.requesterId, 'Approval.requesterId'),
    status: choice(input.status, 'Approval.status', ['pending', 'approved', 'rejected', 'changes_requested', 'expired']),
    expiresAt: string(input.expiresAt, 'Approval.expiresAt'),
    project: { id: string(project.id, 'Approval.project.id'), name: string(project.name, 'Approval.project.name'), slug: string(project.slug, 'Approval.project.slug') },
    session: { id: string(session.id, 'Approval.session.id'), objective: string(session.objective, 'Approval.session.objective'), state: string(session.state, 'Approval.session.state') },
    macroTask: {
      id: string(macroTask.id, 'Approval.macroTask.id'),
      version: integer(macroTask.version, 'Approval.macroTask.version'),
      objective: string(macroTask.objective, 'Approval.macroTask.objective'),
      acceptanceCriteria: strings(macroTask.acceptanceCriteria, 'Approval.macroTask.acceptanceCriteria'),
    },
    decisions: array(input.decisions, 'Approval.decisions').map((decisionValue) => {
      const decision = object(decisionValue, 'Approval.decision');
      return {
        id: string(decision.id, 'Approval.decision.id'),
        approverId: string(decision.approverId, 'Approval.decision.approverId'),
        result: choice(decision.result, 'Approval.decision.result', ['approved', 'rejected', 'changes_requested']),
        reason: string(decision.reason, 'Approval.decision.reason'),
        decidedAt: string(decision.decidedAt, 'Approval.decision.decidedAt'),
      };
    }),
  };
}
