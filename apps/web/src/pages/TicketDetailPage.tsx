import { ArrowLeft, Check, Circle, ExternalLink, FileText, Github, Link2, ShieldAlert, Sparkles, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { TicketSummary } from '@software-factory/contracts';
import { demoTickets, getTicket, reconcileTicketWorkflow } from '../../lib/data';
import { publishTicketToGitHub } from '../../lib/ticketing';

interface TicketDetailModel extends TicketSummary {
  sourceUrl?: string | null;
  project?: { id: string; name: string };
  specification?: { content: string; version: number } | null;
  workflow?: { branchName?: string | null; pullRequestUrl?: string | null; ciStatus?: string | null; reconciledAt?: string | null } | null;
}

type Notice = { kind: 'success' | 'error'; text: string };

export default function TicketDetailPage({ id, onNavigate, login }: { id: string; onNavigate: (path: string) => void; login: string }) {
  const [ticket, setTicket] = useState<TicketDetailModel>(demoTickets.find((item) => item.id === id) ?? demoTickets[0]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [publishingIssue, setPublishingIssue] = useState(false);
  const [pullRequestUrl, setPullRequestUrl] = useState('');
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => { void getTicket(id).then((item) => { setTicket(item); setPullRequestUrl(item.workflow?.pullRequestUrl ?? ''); }); }, [id]);

  const spec = useMemo(() => ticket.specification?.content ?? `# Objectif\n\n${ticket.description}\n\n## Critères d’acceptation\n\n- La fonctionnalité est couverte par des tests automatisés\n- Aucun secret n’est exposé au navigateur\n- Le changement peut être déployé et annulé sans interruption\n\n## Hors périmètre\n\n- Merge automatique\n- Modification des droits de production`, [ticket]);

  async function publishIssue() {
    setPublishingIssue(true);
    setNotice(null);
    try {
      const result = await publishTicketToGitHub(ticket.id);
      setTicket((current) => ({ ...current, sourceUrl: result.remoteUrl }));
      setNotice({ kind: 'success', text: result.outcome === 'created' ? 'Issue GitHub créée et reliée au ticket.' : result.outcome === 'updated' ? 'Issue GitHub actualisée depuis le plan Vistory.' : 'Issue GitHub existante retrouvée et reliée au ticket.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'La synchronisation de l’Issue GitHub a échoué.' });
    } finally {
      setPublishingIssue(false);
    }
  }

  async function reconcileWorkflow() {
    if (!ticket.project?.id || !pullRequestUrl.trim()) {
      setNotice({ kind: 'error', text: 'Le projet et l’URL de la pull request sont requis.' });
      return;
    }
    setReconciling(true);
    setNotice(null);
    try {
      await reconcileTicketWorkflow(ticket.id, ticket.project.id, login, pullRequestUrl.trim());
      const updated = await getTicket(id);
      setTicket(updated);
      setPullRequestUrl(updated.workflow?.pullRequestUrl ?? pullRequestUrl.trim());
      setNotice({ kind: 'success', text: 'Pull request brouillon et preuves CI rattachées au ticket sans nouveau run.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Le rattachement de la pull request a échoué.' });
    } finally {
      setReconciling(false);
    }
  }

  return (
    <div className="page detail-page">
      <AppLink href="/tickets" className="back" onNavigate={onNavigate}><ArrowLeft size={16} />Retour aux tickets</AppLink>
      {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}
      <header className="detail-header">
        <div>
          <div className="detail-meta"><span>#{ticket.externalId}</span><span className={`risk ${ticket.riskLevel}`}>{ticket.riskLevel}</span><span>{ticket.repository ?? 'factory-demo'}</span></div>
          <h1>{ticket.title}</h1>
          <p>{ticket.description}</p>
        </div>
        {ticket.sourceUrl ? (
          <div className="detail-actions">
            <a className="secondary" href={ticket.sourceUrl} target="_blank" rel="noreferrer"><Github size={17} />Voir sur GitHub<ExternalLink size={14} /></a>
            <button className="secondary" type="button" disabled={publishingIssue} onClick={() => void publishIssue()}><Github size={17} />{publishingIssue ? 'Actualisation…' : 'Actualiser l’Issue GitHub'}</button>
          </div>
        ) : (
          <button className="secondary" type="button" disabled={publishingIssue} onClick={() => void publishIssue()}><Github size={17} />{publishingIssue ? 'Création…' : 'Créer l’Issue GitHub'}</button>
        )}
      </header>
      <div className="detail-grid">
        <div className="detail-main">
          <WorkflowProgress />
          <section className="panel reconciliation-panel">
            <div className="panel-title"><div><Link2 size={19} /><h2>Réconcilier une proposition existante</h2></div>{ticket.workflow?.ciStatus && <span className="status green">CI {ticket.workflow.ciStatus}</span>}</div>
            <p>Rattache une pull request brouillon <code>codex/*</code> du dépôt du projet après vérification de ses contrôles CI. Cette action ne crée ni branche, ni PR, ni fusion.</p>
            <form className="reconciliation-form" onSubmit={(event) => { event.preventDefault(); void reconcileWorkflow(); }}>
              <label>URL de la pull request GitHub<input type="url" required placeholder="https://github.com/organisation/depot/pull/123" value={pullRequestUrl} onChange={(event) => setPullRequestUrl(event.target.value)} /></label>
              <button className="secondary" type="submit" disabled={reconciling || !ticket.project?.id}>{reconciling ? 'Vérification…' : 'Vérifier et rattacher'}</button>
            </form>
            {ticket.workflow?.pullRequestUrl && <p><a href={ticket.workflow.pullRequestUrl} target="_blank" rel="noreferrer">{ticket.workflow.branchName ?? 'Proposition GitHub'} <ExternalLink size={13} /></a>{ticket.workflow.reconciledAt ? ` · réconciliée le ${new Date(ticket.workflow.reconciledAt).toLocaleString('fr-FR')}` : ''}</p>}
          </section>
          <section className="panel spec-panel">
            <div className="panel-title">
              <div><FileText size={19} /><h2>Spécification technique</h2><span className="version">v{ticket.specification?.version ?? 1}</span></div>
              <AppLink href={`/tickets/${id}/specification`} className="text-link" onNavigate={onNavigate}>Modifier</AppLink>
            </div>
            <div className="markdown">{renderMarkdown(spec)}</div>
          </section>
        </div>
        <aside className="detail-side">
          <section className="panel decision">
            <div className="decision-head"><ShieldAlert size={21} /><div><h3>Validation requise</h3><p>Ticket classé {ticket.riskLevel}</p></div></div>
            <p>Une seconde personne doit approuver cette spécification avant que Codex puisse être lancé.</p>
            <div className="validator"><span>AM</span><div><strong>Alice Martin</strong><small>Validation principale · approuvée</small></div><Check size={17} /></div>
            <div className="validator pending"><span>ML</span><div><strong>Marc Leroy</strong><small>Validation secondaire · en attente</small></div><Circle size={15} /></div>
            <button className="primary full" type="button" onClick={() => setNotice({ kind: 'success', text: 'Validation enregistrée localement. Connectez PostgreSQL pour persister l’action.' })}><Check size={16} />Approuver la spécification</button>
            <button className="text-button" type="button" onClick={() => setNotice({ kind: 'success', text: 'Demande de modifications préparée. Le workflow API pourra l’enregistrer quand la base sera connectée.' })}>Demander des modifications</button>
          </section>
          <Properties ticket={ticket} />
        </aside>
      </div>
    </div>
  );
}

function WorkflowProgress() {
  return (
    <section className="panel workflow-panel">
      <div className="panel-title"><div><Sparkles size={19} /><h2>Progression</h2></div><span>4 / 7 étapes</span></div>
      <div className="steps">{['Ticket importé', 'Contexte consolidé', 'Spécification générée', 'Validation principale', 'Seconde validation', 'Exécution Codex', 'Revue humaine'].map((step, index) => <div className={index < 4 ? 'complete' : index === 4 ? 'current' : ''} key={step}><span>{index < 4 ? <Check size={14} /> : <Circle size={12} />}</span><small>{step}</small>{index < 6 && <i />}</div>)}</div>
    </section>
  );
}

function Properties({ ticket }: { ticket: TicketDetailModel }) {
  return (
    <section className="panel properties">
      <h3>Informations</h3>
      <dl><div><dt><UserRound size={15} />Assigné à</dt><dd>{ticket.assignee?.name ?? 'Non assigné'}</dd></div><div><dt>Risque</dt><dd><span className={`risk ${ticket.riskLevel}`}>{ticket.riskLevel}</span></dd></div><div><dt>Labels</dt><dd>{ticket.labels.map((label) => <i key={label}>{label}</i>)}</dd></div><div><dt>Branche IA</dt><dd>Créée après validation</dd></div></dl>
    </section>
  );
}

function AppLink({ href, onNavigate, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate: (path: string) => void }) {
  return <a {...props} href={href} onClick={(event) => { event.preventDefault(); onNavigate(href); }}>{children}</a>;
}

function renderMarkdown(specification: string) {
  return specification.split('\n').map((line, index) => line.startsWith('# ') ? <h2 key={index}>{line.slice(2)}</h2> : line.startsWith('## ') ? <h3 key={index}>{line.slice(3)}</h3> : line.startsWith('- ') ? <p className="bullet" key={index}>✓ {line.slice(2)}</p> : line ? <p key={index}>{line}</p> : null);
}
