import { ArrowUpRight, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ProjectSummary, RunSummary } from '@software-factory/contracts';
import { getProjects, getRuns } from '../../lib/data';

export default function WorkflowsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState('');
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    void getProjects().then((items) => {
      if (!active) return;
      setProjects(items);
      setProjectId((current) => current || items.find(({ status: projectStatus }) => projectStatus === 'active')?.id || '');
    }).catch(() => active && setStatus('error'));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setStatus('loading');
    void getRuns(projectId).then((items) => { if (active) { setRuns(items); setStatus('ready'); } }).catch(() => active && setStatus('error'));
    return () => { active = false; };
  }, [projectId]);

  return (
    <div className="page">
      <header className="topbar">
        <div><span className="eyebrow">Exécution durable</span><h1>Sessions et runs</h1><p>État reconstruit depuis PostgreSQL et le journal d’événements.</p></div>
        <PageLink href={`/sessions/new${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`} className="primary" onNavigate={onNavigate}><Play size={17} />Nouvelle session</PageLink>
      </header>
      <label className="project-picker">Projet actif<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
      {status === 'loading' && <State title="Chargement des runs…" description="Lecture du read model persistant." />}
      {status === 'error' && <State title="API indisponible" description="Vérifiez PostgreSQL et l’API locale avant de relancer." />}
      {status === 'ready' && runs.length === 0 && <State title="Aucun run" description="Créez une session, puis développez les tickets prêts un par un." />}
      {status === 'ready' && runs.length > 0 && <div className="cards-list">{runs.map((run) => {
        const completed = run.tasks.filter(({ state }) => state === 'completed').length;
        return <article className="panel list-card run-card" key={run.id}><div><small>{run.correlationId}</small><h3>{run.session.objective}</h3><p>{completed}/{run.tasks.length} tâches · état {run.state}</p></div><PageLink href={`/runs/${run.id}?projectId=${encodeURIComponent(run.projectId)}`} className="secondary" onNavigate={onNavigate}>Superviser<ArrowUpRight size={14} /></PageLink></article>;
      })}</div>}
    </div>
  );
}

function PageLink({ href, className, onNavigate, children }: { href: string; className: string; onNavigate: (path: string) => void; children: React.ReactNode }) {
  return <a href={href} className={className} onClick={(event) => { event.preventDefault(); onNavigate(href); }}>{children}</a>;
}

function State({ title, description }: { title: string; description: string }) {
  return <section className="panel state-panel"><h2>{title}</h2><p>{description}</p></section>;
}
