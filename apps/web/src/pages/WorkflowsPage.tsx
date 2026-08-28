import { ArrowUpRight, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ProjectSummary, RunSummary } from '@software-factory/contracts';
import { getProjects, getReadySessions, getRuns, startSessionRun, type ReadySessionSummary } from '../../lib/data';

export default function WorkflowsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState('');
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [readySessions, setReadySessions] = useState<ReadySessionSummary[]>([]);
  const [startingSessionId, setStartingSessionId] = useState('');
  const [message, setMessage] = useState('');
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
    setMessage('');
    void Promise.all([getRuns(projectId), getReadySessions(projectId)])
      .then(([runItems, sessionItems]) => {
        if (!active) return;
        setRuns(runItems);
        setReadySessions(sessionItems);
        setStatus('ready');
      })
      .catch(() => active && setStatus('error'));
    return () => { active = false; };
  }, [projectId]);

  async function startRun(session: ReadySessionSummary) {
    setStartingSessionId(session.id);
    setMessage('');
    try {
      const run = await startSessionRun(projectId, session.id);
      onNavigate(`/runs/${run.id}?projectId=${encodeURIComponent(projectId)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Le démarrage du run a échoué.');
      setStartingSessionId('');
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div><span className="eyebrow">Exécution durable</span><h1>Sessions et runs</h1><p>État reconstruit depuis PostgreSQL et le journal d’événements.</p></div>
        <PageLink href={`/sessions/new${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`} className="primary" onNavigate={onNavigate}><Play size={17} />Nouvelle session</PageLink>
      </header>
      <label className="project-picker">Projet actif<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
      {message && <div className="notice error">{message}</div>}
      {status === 'loading' && <State title="Chargement des runs…" description="Lecture du read model persistant." />}
      {status === 'error' && <State title="API indisponible" description="Vérifiez PostgreSQL et l’API locale avant de relancer." />}
      {status === 'ready' && readySessions.length > 0 && <div className="cards-list">{readySessions.map((session) => (
        <article className="panel list-card run-card" key={session.id}>
          <div><small>Session approuvée</small><h3>{session.objective}</h3><p>Le run n’a pas encore été démarré.</p></div>
          <button className="primary" type="button" disabled={startingSessionId === session.id} onClick={() => void startRun(session)}><Play size={15} />{startingSessionId === session.id ? 'Démarrage…' : 'Démarrer le run'}</button>
        </article>
      ))}</div>}
      {status === 'ready' && runs.length === 0 && readySessions.length === 0 && <State title="Aucun run" description="Créez une session, puis développez les tickets prêts un par un." />}
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
