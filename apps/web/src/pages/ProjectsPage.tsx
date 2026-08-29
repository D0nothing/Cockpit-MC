import { ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ProjectSummary } from '@software-factory/contracts';
import { getProjects, updateProjectApprovalPolicy } from '../../lib/data';

export default function ProjectsPage({ onNavigate, login }: { onNavigate: (path: string) => void; login: string }) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [policyDraft, setPolicyDraft] = useState<{ projectId: string; reason: string; confirmed: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    void getProjects().then((items) => active && setProjects(items)).catch(() => active && setError('L’API n’a pas pu charger les projets.'));
    return () => { active = false; };
  }, []);
  async function changePolicy(project: ProjectSummary) {
    const enabling = project.effectiveApprovalMode !== 'SOLO_DEV';
    if (!policyDraft || policyDraft.projectId !== project.id || policyDraft.reason.trim().length < 10 || !policyDraft.confirmed) {
      setError('Renseignez un motif de 10 caractères minimum et confirmez les garde-fous.');
      return;
    }
    setBusyId(project.id);
    setError('');
    try {
      const expiresAt = enabling ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString() : undefined;
      const updated = await updateProjectApprovalPolicy(project, login, enabling ? 'SOLO_DEV' : 'FOUR_EYES', policyDraft.reason.trim(), expiresAt);
      setProjects((current) => current?.map((item) => item.id === updated.id ? updated : item) ?? null);
      setPolicyDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La politique n’a pas pu être modifiée.');
    } finally {
      setBusyId('');
    }
  }

  return <div className="page"><header className="topbar"><div><span className="eyebrow">Registre partagé</span><h1>Projets</h1><p>Chaque projet conserve ses identifiants, dépôts et politiques isolés.</p></div></header>
    {!projects && !error && <State title="Chargement des projets…" description="Lecture du registre PostgreSQL." />}
    {error && <div className="notice error">{error}</div>}
    {projects && <div className="cards-list">{projects.map((project) => {
      const editing = policyDraft?.projectId === project.id;
      const enabling = project.effectiveApprovalMode !== 'SOLO_DEV';
      return <article className="panel list-card" key={project.id}><div><small>Profil v{project.profileVersion} · politique v{project.approvalPolicyVersion} · {project.status}</small><h3>{project.name}</h3><p>{project.githubOwner}/{project.githubRepository} · projectId {project.id}</p><p className="policy-line"><strong>{project.effectiveApprovalMode === 'SOLO_DEV' ? 'SOLO_DEV actif' : 'Règle des quatre yeux'}</strong>{project.soloDevExpiresAt && project.effectiveApprovalMode === 'SOLO_DEV' ? ` · expiration ${new Date(project.soloDevExpiresAt).toLocaleString('fr-FR')}` : ''}{project.approvalMode === 'SOLO_DEV' && project.effectiveApprovalMode === 'FOUR_EYES' ? ' · exception expirée' : ''}</p>{project.approvalPolicyReason && <small>Dernier motif : {project.approvalPolicyReason}</small>}</div><div className="project-actions"><button type="button" className="secondary" disabled={busyId === project.id} onClick={() => setPolicyDraft(editing ? null : { projectId: project.id, reason: '', confirmed: false })}>{editing ? 'Annuler' : enabling ? 'Activer SOLO_DEV' : 'Révoquer SOLO_DEV'}</button><a href={`/sessions/new?projectId=${encodeURIComponent(project.id)}`} className="secondary" onClick={(event) => { event.preventDefault(); onNavigate(`/sessions/new?projectId=${encodeURIComponent(project.id)}`); }}>Nouvelle session<ArrowUpRight size={14} /></a>{editing && <form className="policy-form" onSubmit={(event) => { event.preventDefault(); void changePolicy(project); }}><label>Motif de {enabling ? 'l’activation' : 'la révocation'}<textarea value={policyDraft.reason} minLength={10} maxLength={500} required onChange={(event) => setPolicyDraft({ ...policyDraft, reason: event.target.value })} /></label><label className="confirmation-row"><input type="checkbox" checked={policyDraft.confirmed} onChange={(event) => setPolicyDraft({ ...policyDraft, confirmed: event.target.checked })} /><span>{enabling ? 'Je confirme une exception de 7 jours limitée aux branches codex/*, PR brouillon et preuves de tests, sans production ni service live.' : 'Je confirme la révocation immédiate et le retour à la règle des quatre yeux.'}</span></label><button className="primary" type="submit" disabled={busyId === project.id || policyDraft.reason.trim().length < 10 || !policyDraft.confirmed}>{busyId === project.id ? 'Enregistrement…' : 'Confirmer la politique'}</button></form>}</div></article>;
    })}</div>}
  </div>;
}

function State({ title, description }: { title: string; description: string }) {
  return <section className="panel state-panel"><h2>{title}</h2><p>{description}</p></section>;
}
