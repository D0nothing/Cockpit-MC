import { Activity, ArrowLeft, Boxes, CheckCircle2, MessageSquareText, Network, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { RunReadModel } from '@software-factory/contracts';
import { createArtifactFeedback, dispatchRunTask, getRun } from '../../lib/run-detail';

type Provider = 'worker-simulator' | 'github-actions';
type FeedbackKind = 'quality' | 'correction' | 'risk' | 'cost';

export default function RunDetailPage({ id, projectId, onNavigate }: { id: string; projectId: string; onNavigate: (path: string) => void }) {
  const [run, setRun] = useState<RunReadModel | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyTask, setBusyTask] = useState('');
  const [provider, setProvider] = useState<Provider>('worker-simulator');
  const [artifactId, setArtifactId] = useState('');
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind>('quality');
  const [rating, setRating] = useState<-1 | 0 | 1>(1);
  const [comment, setComment] = useState('Le résultat est utile et les preuves correspondent aux critères attendus.');
  const [feedbackId, setFeedbackId] = useState('');

  const refresh = useCallback(async () => {
    if (!projectId) throw new Error('Le contexte projet est obligatoire.');
    const value = await getRun(id, projectId);
    setRun(value);
    setArtifactId((current) => current || value.artifacts[0]?.id || '');
  }, [id, projectId]);

  useEffect(() => {
    let active = true;
    void refresh().catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : 'Run indisponible'));
    return () => { active = false; };
  }, [refresh]);

  async function dispatch(taskId: string) {
    setBusyTask(taskId);
    setError('');
    setMessage('');
    try {
      await dispatchRunTask(id, taskId, projectId, provider);
      await refresh();
      setMessage(provider === 'worker-simulator' ? `Ticket ${taskId} exécuté avec une preuve locale.` : `Ticket ${taskId} confié au workflow GitHub gouverné.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Dispatch impossible');
    } finally {
      setBusyTask('');
    }
  }

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!run || !artifactId) return;
    setError('');
    try {
      const feedback = await createArtifactFeedback({ projectId, sessionId: run.sessionId, runId: run.id, artifactId, kind: feedbackKind, rating, comment });
      setFeedbackId(feedback.id);
      setMessage('Feedback enregistré dans la mémoire temporaire. Il ne modifiera la KB qu’après promotion humaine.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Feedback impossible');
    }
  }

  if (!run && error) return <div className="page"><StatePanel title="Run inaccessible" description={error} /></div>;
  if (!run) return <div className="page"><StatePanel title="Chargement du run…" description="Reconstruction depuis les événements persistés." /></div>;

  const completed = run.tasks.filter(({ state }) => state === 'completed').length;
  return (
    <div className="page detail-page run-detail">
      <a href="/workflows" className="back" onClick={(event) => { event.preventDefault(); onNavigate('/workflows'); }}><ArrowLeft size={16} />Retour aux runs</a>
      <header className="detail-header">
        <div><div className="detail-meta"><span>{run.project.name}</span><span className={`status ${run.state === 'review' ? 'purple' : 'green'}`}>{run.state}</span></div><h1>{run.session.objective}</h1><p>{run.macroTask.expectedOutcome}</p></div>
        <span className="secondary"><Network size={17} />{run.correlationId}</span>
      </header>
      {error && <div className="notice error">{error}</div>}
      {message && <div className="notice success">{message}</div>}

      <section className="panel execution-toolbar">
        <div><ShieldCheck size={19} /><div><strong>Exécution ticket par ticket</strong><small>Les boutons ne s’activent que lorsque les dépendances sont terminées.</small></div></div>
        <label>Adaptateur<select value={provider} onChange={(event) => setProvider(event.target.value as Provider)}><option value="worker-simulator">Simulateur local · sans effet externe</option><option value="github-actions">GitHub Actions · branche + PR brouillon</option></select></label>
        <button className="icon-button" type="button" aria-label="Actualiser" onClick={() => void refresh()}><RefreshCw size={16} /></button>
      </section>

      <div className="run-grid">
        <section className="panel">
          <div className="panel-title"><div><Boxes size={19} /><h2>Graphe de tickets</h2></div><span>{completed}/{run.tasks.length}</span></div>
          <div className="task-graph">{run.graph.nodes.map((node) => {
            const task = run.tasks.find(({ taskId }) => taskId === node.taskId);
            const lastDispatch = task?.dispatches[0];
            return <article key={node.taskId} className={`task-${task?.state ?? 'unknown'}`}>
              <div className="task-ticket"><strong>{task?.ticket ? `#${task.ticket.externalId} · ${task.ticket.title}` : node.taskId}</strong><small>{task?.ticket?.epic ? `${task.ticket.epic.key} · ${task.ticket.epic.title}` : node.capability}</small></div>
              <span>{node.capability}</span>
              <small>{node.dependsOn.length ? `Après ${node.dependsOn.join(', ')}` : 'Prête immédiatement'}</small>
              <div className="task-action"><em>{task?.state ?? 'unknown'}</em>{task?.state === 'ready' && <button className="primary compact" type="button" disabled={busyTask === node.taskId} onClick={() => void dispatch(node.taskId)}><Play size={13} />{busyTask === node.taskId ? 'Exécution…' : 'Développer'}</button>}{lastDispatch?.error && <small className="task-error">{lastDispatch.error}</small>}</div>
            </article>;
          })}</div>
        </section>
        <section className="panel">
          <div className="panel-title"><div><Activity size={19} /><h2>Chronologie</h2></div><span>{run.events.length} événements</span></div>
          <ol className="timeline">{run.events.map((event) => <li key={event.id}><i>{event.sequence}</i><div><strong>{event.type}</strong><small>{event.actorType} · {event.actorId}</small></div></li>)}</ol>
        </section>
      </div>

      <section className="panel evidence-panel">
        <div className="panel-title"><div><CheckCircle2 size={19} /><h2>Preuves</h2></div><span>stocké {run.storedState} · reconstruit {run.state}</span></div>
        <div className="artifact-grid">{run.artifacts.map((artifact) => <article key={artifact.id}><strong>{artifact.taskId} · {artifact.kind}</strong><small>{artifact.mediaType}</small><code>{artifact.contentHash}</code></article>)}</div>
      </section>

      {run.artifacts.length > 0 && <section className="panel feedback-panel">
        <div className="panel-title"><div><MessageSquareText size={19} /><h2>Qualifiez le résultat</h2></div><span>feedback → mémoire temporaire → candidat KB</span></div>
        <form onSubmit={submitFeedback}>
          <label>Preuve<select value={artifactId} onChange={(event) => setArtifactId(event.target.value)}>{run.artifacts.map((artifact) => <option key={artifact.id} value={artifact.id}>{artifact.taskId} · {artifact.contentHash.slice(0, 10)}</option>)}</select></label>
          <label>Type<select value={feedbackKind} onChange={(event) => setFeedbackKind(event.target.value as FeedbackKind)}><option value="quality">Qualité</option><option value="correction">Correction</option><option value="risk">Risque</option><option value="cost">Coût</option></select></label>
          <label>Évaluation<select value={rating} onChange={(event) => setRating(Number(event.target.value) as -1 | 0 | 1)}><option value={1}>Positive</option><option value={0}>Neutre</option><option value={-1}>Négative</option></select></label>
          <label className="feedback-comment">Commentaire<textarea value={comment} onChange={(event) => setComment(event.target.value)} minLength={1} maxLength={5_000} rows={3} required /></label>
          <button className="primary" type="submit">Enregistrer le feedback</button>
          {feedbackId && <button className="secondary" type="button" onClick={() => onNavigate(`/knowledge?projectId=${encodeURIComponent(projectId)}&feedbackId=${encodeURIComponent(feedbackId)}`)}>Proposer à la KB</button>}
        </form>
      </section>}
    </div>
  );
}

function StatePanel({ title, description }: { title: string; description: string }) {
  return <section className="panel state-panel"><h2>{title}</h2><p>{description}</p></section>;
}
