import { BookCheck, BrainCircuit, CheckCircle2, CircleAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectSummary } from '@software-factory/contracts';
import { getProjects } from '../../lib/data';
import { decideKnowledge, getFeedback, getKnowledgeCandidates, getKnowledgeEntries, promoteKnowledge, proposeKnowledge, revokeKnowledge, type FeedbackItem, type KnowledgeCandidateItem, type KnowledgeEntryItem, type KnowledgeScope } from '../../lib/knowledge';

export default function KnowledgePage({ initialProjectId, initialFeedbackId }: { initialProjectId: string; initialFeedbackId: string }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [candidates, setCandidates] = useState<KnowledgeCandidateItem[]>([]);
  const [entries, setEntries] = useState<KnowledgeEntryItem[]>([]);
  const [feedbackId, setFeedbackId] = useState(initialFeedbackId);
  const [scope, setScope] = useState<KnowledgeScope>('project');
  const [key, setKey] = useState('delivery.reusable-rule');
  const [title, setTitle] = useState('Règle issue du retour terrain');
  const [content, setContent] = useState('Décrire ici une règle stable, bornée, vérifiable et réutilisable.');
  const [reviewerId, setReviewerId] = useState('independent-reviewer');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async (selectedProjectId: string) => {
    const [feedbackItems, candidateItems, entryItems] = await Promise.all([getFeedback(selectedProjectId), getKnowledgeCandidates(selectedProjectId), getKnowledgeEntries(selectedProjectId)]);
    setFeedback(feedbackItems);
    setCandidates(candidateItems);
    setEntries(entryItems);
    setFeedbackId((current) => current || feedbackItems.find((item) => !item.candidateId)?.id || '');
  }, []);

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
    void refresh(projectId).then(() => active && setStatus('ready')).catch(() => active && setStatus('error'));
    return () => { active = false; };
  }, [projectId, refresh]);

  const availableFeedback = useMemo(() => feedback.filter((item) => !item.candidateId || item.id === feedbackId), [feedback, feedbackId]);

  async function act(action: () => Promise<void>, success: string) {
    setMessage('');
    try { await action(); await refresh(projectId); setMessage(success); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Action impossible'); }
  }

  return (
    <div className="page knowledge-page">
      <header className="topbar"><div><span className="eyebrow">Boucle d’apprentissage gouvernée</span><h1>Knowledge Base</h1><p>Le feedback reste temporaire jusqu’à sa proposition, sa revue et sa promotion explicite.</p></div></header>
      <label className="project-picker">Projet actif<select value={projectId} onChange={(event) => { setProjectId(event.target.value); setFeedbackId(''); }}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      {message && <div className={`notice ${message.includes('impossible') || message.includes('invalid') || message.includes('cannot') ? 'error' : 'success'}`}>{message}</div>}
      {status === 'loading' && <State title="Chargement de la mémoire gouvernée…" />}
      {status === 'error' && <State title="Knowledge Base indisponible" />}
      {status === 'ready' && <>
        <section className="knowledge-stats">
          <article className="panel"><BrainCircuit /><div><strong>{feedback.length}</strong><span>feedbacks avec preuve</span></div></article>
          <article className="panel"><ShieldCheck /><div><strong>{candidates.filter((item) => item.status === 'proposed').length}</strong><span>candidats à revoir</span></div></article>
          <article className="panel"><BookCheck /><div><strong>{entries.length}</strong><span>entrées actives et citées</span></div></article>
        </section>

        <div className="knowledge-layout">
          <section className="panel knowledge-form">
            <div className="panel-title"><div><BrainCircuit size={19} /><h2>Proposer une connaissance</h2></div></div>
            <p>Une proposition part obligatoirement d’un feedback rattaché à un artefact. Aucune publication n’est automatique.</p>
            <form onSubmit={(event) => { event.preventDefault(); void act(() => proposeKnowledge({ projectId, feedbackId, scope, key, title, content }), 'Candidat créé. Il attend une validation indépendante.'); }}>
              <label>Feedback source<select value={feedbackId} onChange={(event) => setFeedbackId(event.target.value)} required><option value="" disabled>Choisir un feedback non promu</option>{availableFeedback.map((item) => <option key={item.id} value={item.id}>{item.kind} · {item.comment.slice(0, 70)}</option>)}</select></label>
              <label>Portée<select value={scope} onChange={(event) => setScope(event.target.value as KnowledgeScope)}><option value="project">Projet · 1 approbation</option><option value="common">Commune · 2 approbations</option></select></label>
              <label>Clé<input value={key} onChange={(event) => setKey(event.target.value)} pattern="[a-z0-9][a-z0-9._-]{1,99}" required /></label>
              <label>Titre<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} required /></label>
              <label>Contenu<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={20_000} rows={6} required /></label>
              {scope === 'common' && <div className="notice"><CircleAlert size={16} />La portée commune rendra l’entrée visible aux autres projets après deux validations distinctes.</div>}
              <button className="primary" type="submit" disabled={!feedbackId}>Créer le candidat</button>
            </form>
          </section>

          <section className="panel candidate-list">
            <div className="panel-title"><div><ShieldCheck size={19} /><h2>File de promotion</h2></div><span>{candidates.length} candidats</span></div>
            <label className="reviewer-field">Identité du réviseur<input value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} /></label>
            {candidates.length === 0 && <p>Aucun candidat pour ce projet.</p>}
            {candidates.map((candidate) => <article key={candidate.id}>
              <div className="candidate-head"><div><small>{candidate.scope} · {candidate.key}</small><h3>{candidate.title}</h3></div><span className={`status ${candidate.status === 'promoted' ? 'green' : candidate.status === 'approved' ? 'blue' : 'purple'}`}>{candidate.status}</span></div>
              <p>{candidate.content}</p>
              <small>{candidate.decisions.filter((decision) => decision.result === 'approved').length}/{candidate.requiredApprovals} approbations · proposé par {candidate.proposedBy}</small>
              <div className="candidate-actions">
                {candidate.status === 'proposed' && <button className="secondary" type="button" onClick={() => void act(() => decideKnowledge(projectId, candidate.id, reviewerId), 'Décision enregistrée.')}><CheckCircle2 size={14} />Approuver</button>}
                {candidate.status === 'approved' && <button className="primary" type="button" onClick={() => void act(() => promoteKnowledge(projectId, candidate.id), 'Connaissance promue et versionnée.')}><BookCheck size={14} />Promouvoir</button>}
                {candidate.entry && <code>{`kb:${candidate.entry.id}@${candidate.entry.version}`}</code>}
              </div>
            </article>)}
          </section>
        </div>

        <section className="panel active-knowledge">
          <div className="panel-title"><div><BookCheck size={19} /><h2>Connaissances actives injectables</h2></div><span>{entries.length} résultats maximum 20</span></div>
          {entries.length === 0 && <p>Aucune entrée active : les contenus bruts et révoqués ne sont jamais injectés.</p>}
          {entries.map((entry) => <article key={entry.id}><div><small>{entry.scope} · {entry.key} · v{entry.version}</small><p>{entry.content}</p><code>{entry.citation}</code></div><button className="icon-button danger" type="button" aria-label={`Révoquer ${entry.key}`} onClick={() => { const reason = window.prompt('Motif de révocation'); if (reason) void act(() => revokeKnowledge(projectId, entry.id, reason), 'Entrée révoquée, historique conservé.'); }}><Trash2 size={16} /></button></article>)}
        </section>
      </>}
    </div>
  );
}

function State({ title }: { title: string }) {
  return <section className="panel state-panel"><h2>{title}</h2></section>;
}
