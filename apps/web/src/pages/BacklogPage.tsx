import { GitBranch, ListChecks } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ProjectSummary } from '@software-factory/contracts';
import { getBacklog, type BacklogEpic } from '../../lib/backlog';
import { getProjects } from '../../lib/data';

export default function BacklogPage({ initialProjectId }: { initialProjectId: string }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [epics, setEpics] = useState<BacklogEpic[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    void getProjects().then((items) => {
      if (!active) return;
      setProjects(items);
      setProjectId((current) => current || items.find((project) => project.status === 'active')?.id || '');
    }).catch(() => active && setStatus('error'));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setStatus('loading');
    void getBacklog(projectId).then((items) => { if (active) { setEpics(items); setStatus('ready'); } }).catch(() => active && setStatus('error'));
    return () => { active = false; };
  }, [projectId]);

  return (
    <div className="page backlog-page">
      <header className="topbar"><div><span className="eyebrow">Découpage produit</span><h1>Epics et tickets</h1><p>La demande est transformée en lots cohérents, tickets dépendants et critères vérifiables.</p></div></header>
      <label className="project-picker">Projet actif<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      {status === 'loading' && <State title="Chargement du backlog…" />}
      {status === 'error' && <State title="Backlog indisponible" />}
      {status === 'ready' && epics.length === 0 && <State title="Aucun epic planifié" />}
      {status === 'ready' && <div className="epic-grid">{epics.map((epic) => <section className="panel epic-card" key={epic.id}>
        <div className="epic-head"><div><span className="eyebrow">{epic.key} · {epic.session.riskLevel}</span><h2>{epic.title}</h2></div><span className={`status ${epic.status === 'review' ? 'purple' : 'green'}`}>{epic.status}</span></div>
        <p>{epic.objective}</p><small>{epic.expectedOutcome}</small>
        <div className="epic-tickets">{epic.tickets.map((ticket) => <article key={ticket.id}>
          <div className="ticket-sequence"><GitBranch size={15} /><strong>#{ticket.externalId} · {ticket.title}</strong></div>
          <div className="ticket-meta"><span>{ticket.capability}</span><span>{ticket.complexity}</span><span>{ticket.status}</span></div>
          <p>{ticket.dependsOn.length ? `Dépend de : ${ticket.dependsOn.join(', ')}` : 'Point d’entrée du graphe'}</p>
          <small><ListChecks size={13} />{ticket.acceptanceCriteria[0]}</small>
        </article>)}</div>
      </section>)}</div>}
    </div>
  );
}

function State({ title }: { title: string }) {
  return <section className="panel state-panel"><h2>{title}</h2></section>;
}
