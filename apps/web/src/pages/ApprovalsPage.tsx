import { Check, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ProjectSummary } from '@software-factory/contracts';
import { decideApproval, getApprovals, type ApprovalReadModel } from '../../lib/approvals';
import { getProjects } from '../../lib/data';

export default function ApprovalsPage({ initialProjectId }: { initialProjectId: string }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [approvals, setApprovals] = useState<ApprovalReadModel[]>([]);
  const [approverId, setApproverId] = useState('user-marc');
  const [refreshToken, setRefreshToken] = useState(0);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getProjects().then((items) => {
      if (!active) return;
      setProjects(items);
      setProjectId((current) => current || items.find(({ status }) => status === 'active')?.id || '');
    }).catch(() => active && setError('Impossible de charger les projets.'));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setError('');
    void getApprovals(projectId).then((items) => active && setApprovals(items)).catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : 'Validations indisponibles.'));
    return () => { active = false; };
  }, [projectId, refreshToken]);

  async function decide(approvalId: string, result: 'approved' | 'rejected') {
    setBusyId(approvalId);
    setError('');
    try {
      await decideApproval(projectId, approvalId, approverId, result);
      setRefreshToken((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La décision a échoué.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="page">
      <header className="topbar"><div><span className="eyebrow">Contrôle humain</span><h1>Validations</h1><p>Les opérations sensibles exigent une décision distincte du demandeur ; les opérations critiques en exigent deux.</p></div></header>
      <div className="approval-toolbar">
        <label className="project-picker">Projet
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select>
        </label>
        <label className="project-picker">Identité de validation
          <select value={approverId} onChange={(event) => setApproverId(event.target.value)}><option value="user-marc">Marc Leroy</option><option value="user-sophie">Sophie Bernard</option></select>
        </label>
      </div>
      {error && <div className="notice error">{error}</div>}
      {!error && approvals.length === 0 && <section className="panel state-panel"><h2>Aucune validation</h2><p>Les demandes sensibles et critiques apparaîtront ici après planification.</p></section>}
      <div className="cards-list approval-list">{approvals.map((approval) => (
        <article className={`panel approval-card ${approval.riskLevel}`} key={approval.id}>
          <div className="approval-card-head"><div><small>{approval.project.name} · demandeur {approval.requesterId}</small><h3>{approval.session.objective}</h3></div><span className={`status ${approval.status === 'approved' ? 'green' : approval.status === 'pending' ? 'amber' : 'neutral'}`}>{approval.status}</span></div>
          <p>{approval.decisions.filter(({ result }) => result === 'approved').length}/{approval.requiredApprovals} approbations · risque {approval.riskLevel} · expiration {new Date(approval.expiresAt).toLocaleString('fr-FR')}</p>
          <ul>{approval.macroTask.acceptanceCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
          {approval.decisions.length > 0 && <div className="approval-decisions">{approval.decisions.map((decision) => <span key={decision.id}><Check size={13} />{decision.approverId}</span>)}</div>}
          {approval.status === 'pending' && <div className="approval-actions"><button className="primary" type="button" disabled={busyId === approval.id} onClick={() => void decide(approval.id, 'approved')}><ShieldCheck size={15} />Approuver</button><button className="secondary" type="button" disabled={busyId === approval.id} onClick={() => void decide(approval.id, 'rejected')}><ShieldAlert size={15} />Refuser</button></div>}
        </article>
      ))}</div>
    </div>
  );
}
