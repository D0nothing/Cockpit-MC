import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  FileCheck2,
  Fingerprint,
  LayoutDashboard,
  Play,
  Settings,
  ShieldCheck,
  Tickets,
} from 'lucide-react';
import type { ProjectSummary } from '@software-factory/contracts';
import { getAuthSession, githubLoginUrl, logout, type AuthSession } from '../lib/auth';
import { demoTickets, getProjects, launchSession, type SessionRiskLevel } from '../lib/data';
import '../app/globals.css';

const navigation = [
  [LayoutDashboard, 'Vue d’ensemble', '/'],
  [Tickets, 'Tickets', '/tickets'],
  [Tickets, 'Epics & backlog', '/backlog'],
  [FileCheck2, 'Spécifications', '/specifications'],
  [Activity, 'Workflows IA', '/workflows'],
  [ShieldCheck, 'Validations', '/approvals'],
  [ShieldCheck, 'Journal d’audit', '/audit'],
  [BookOpen, 'Knowledge Base', '/knowledge'],
  [LayoutDashboard, 'Projets', '/projects'],
] as const;

const LazyApprovalsPage = React.lazy(() => import('./pages/ApprovalsPage'));
const LazyRunDetailPage = React.lazy(() => import('./pages/RunDetailPage'));
const LazyTicketDetailPage = React.lazy(() => import('./pages/TicketDetailPage'));
const LazyBacklogPage = React.lazy(() => import('./pages/BacklogPage'));
const LazyKnowledgePage = React.lazy(() => import('./pages/KnowledgePage'));
const LazyWorkflowsPage = React.lazy(() => import('./pages/WorkflowsPage'));
const LazyProjectsPage = React.lazy(() => import('./pages/ProjectsPage'));
const LazyDashboardPage = React.lazy(() => import('./pages/DashboardPage').then(({ DashboardPage }) => ({ default: DashboardPage })));
const LazyTicketsPage = React.lazy(() => import('./pages/DashboardPage').then(({ TicketsPage }) => ({ default: TicketsPage })));

function App() {
  const [path, setPath] = usePathname();
  const { session, error, refresh, signOut } = useAuthentication();

  if (session === null && !error) return <AuthenticationPage state="loading" />;
  if (error) return <AuthenticationPage state="error" onRetry={refresh} />;
  if (!session?.authenticated) return <AuthenticationPage state="signed-out" />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <AppLink href="/" className="brand" onNavigate={setPath}>
          <span className="brand-mark">VO</span>
          <span>Vistory <b>OS</b></span>
        </AppLink>
        <nav>
          {navigation.map(([Icon, label, href]) => (
            <AppLink href={href} className={isActive(path, href) ? 'active' : ''} key={label} onNavigate={setPath}>
              <Icon size={18} />
              <span>{label}</span>
            </AppLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <AppLink href="/docs" onNavigate={setPath}><BookOpen size={18} />Documentation</AppLink>
          <AppLink href="/settings" onNavigate={setPath}><Settings size={18} />Paramètres</AppLink>
          <button className="profile profile-button" type="button" onClick={() => void signOut()} aria-label="Se déconnecter de Vistory OS">
            <span>{session.login.slice(0, 2).toUpperCase()}</span><div><strong>{session.login}</strong><small>Cliquer pour se déconnecter</small></div>
          </button>
        </div>
      </aside>
      <main>{route(path, setPath, session.login)}</main>
    </div>
  );
}

function AuthenticationPage({ state, onRetry }: { state: 'loading' | 'error' | 'signed-out'; onRetry?: () => void }) {
  const loginUrl = githubLoginUrl();
  return (
    <main className="auth-shell">
      <section className="panel auth-panel">
        <span className="brand-mark">VO</span>
        <span className="eyebrow">Accès privé mono-utilisateur</span>
        <h1>Vistory OS</h1>
        {state === 'loading' && <p>Vérification de la session GitHub…</p>}
        {state === 'error' && <><p>Impossible de joindre le service d’authentification.</p><button className="secondary" type="button" onClick={onRetry}>Réessayer</button></>}
        {state === 'signed-out' && <><p>Seul le compte GitHub autorisé par l’administrateur peut ouvrir ce cockpit.</p>{loginUrl ? <a className="primary" href={loginUrl}>Se connecter avec GitHub</a> : <div className="notice error">L’URL de l’API n’est pas configurée.</div>}</>}
      </section>
    </main>
  );
}

function SpecificationEditor({ id, onNavigate }: { id: string; onNavigate: (path: string) => void }) {
  const ticket = demoTickets.find((item) => item.id === id) ?? demoTickets[0];
  return (
    <PlaceholderPage
      eyebrow={`Ticket #${ticket.externalId}`}
      title="Édition de la spécification"
      description="L’écran est prêt pour brancher l’édition persistée via l’API. Pour l’instant, la démonstration reste en lecture seule."
      primary={{ label: 'Retour au ticket', href: `/tickets/${id}` }}
      onNavigate={onNavigate}
    />
  );
}

function NewTicketPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <PlaceholderPage eyebrow="Création" title="Nouveau ticket" description="La création sera reliée à GitHub Issues et à PostgreSQL. Le bouton est maintenant une vraie page, plus un cul-de-sac." primary={{ label: 'Voir les tickets', href: '/tickets' }} onNavigate={onNavigate} />;
}

function SpecificationsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const specs = demoTickets.filter((ticket) => ['spec_review_required', 'second_validation_required', 'ready_for_ai'].includes(ticket.status));
  return (
    <div className="page">
      <header className="topbar"><div><span className="eyebrow">Contrôle qualité</span><h1>Spécifications</h1><p>Specs à relire, valider ou envoyer vers l’exécution IA.</p></div></header>
      <div className="cards-list">{specs.map((ticket) => <article className="panel list-card" key={ticket.id}><div><small>#{ticket.externalId}</small><h3>{ticket.title}</h3><p>{ticket.description}</p></div><AppLink href={`/tickets/${ticket.id}`} className="secondary" onNavigate={onNavigate}>Ouvrir<ArrowUpRight size={14} /></AppLink></article>)}</div>
    </div>
  );
}

function NewSessionPage({ projectId: initialProjectId, onNavigate }: { projectId: string; onNavigate: (path: string) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [objective, setObjective] = useState('Construire et vérifier une première fonctionnalité Vistory OS sans effet externe.');
  const [riskLevel, setRiskLevel] = useState<SessionRiskLevel>('standard');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getProjects().then((items) => {
      if (!active) return;
      setProjects(items.filter(({ status }) => status === 'active'));
      setProjectId((current) => current || items.find(({ status }) => status === 'active')?.id || '');
    }).catch(() => active && setError('Impossible de charger les projets actifs.'));
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || objective.trim().length < 10) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await launchSession(projectId, objective.trim(), riskLevel);
      onNavigate(result.kind === 'approval' ? `/approvals?projectId=${encodeURIComponent(projectId)}` : `/runs/${result.runId}?projectId=${encodeURIComponent(projectId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le lancement a échoué.');
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <AppLink href="/workflows" className="back" onNavigate={onNavigate}><ArrowLeft size={16} />Retour aux runs</AppLink>
      <section className="panel session-form">
        <span className="eyebrow">Thinking mode déterministe</span>
        <h1>Nouvelle session</h1>
        <p>L’objectif sera persisté, découpé en epics et tickets dépendants, puis ouvert dans le cockpit d’exécution. Aucun fournisseur externe n’est appelé sans sélection explicite.</p>
        {error && <div className="notice error">{error}</div>}
        <form onSubmit={submit}>
          <label>Projet
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>
              <option value="" disabled>Choisir un projet</option>
              {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label>Objectif
            <textarea value={objective} onChange={(event) => setObjective(event.target.value)} minLength={10} maxLength={10_000} rows={6} required />
          </label>
          <label>Niveau de risque
            <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as SessionRiskLevel)}><option value="standard">Standard · aucune approbation</option><option value="sensitive">Sensible · une approbation</option><option value="critical">Critique · deux approbations</option></select>
          </label>
          <button className="primary" type="submit" disabled={submitting || !projectId}>{submitting ? 'Traitement en cours…' : riskLevel === 'standard' ? 'Créer et ouvrir le run' : 'Créer et demander validation'}<Play size={16} /></button>
        </form>
      </section>
    </div>
  );
}

function StatePanel({ title, description }: { title: string; description: string }) {
  return <section className="panel state-panel"><h2>{title}</h2><p>{description}</p></section>;
}

function DocsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <PlaceholderPage eyebrow="Aide" title="Documentation" description="Cette page centralisera les règles de sécurité, les workflows et les conventions de validation." primary={{ label: 'Journal d’audit', href: '/audit' }} onNavigate={onNavigate} />;
}

function SettingsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <PlaceholderPage eyebrow="Configuration" title="Paramètres" description="Connecteurs, variables d’environnement, permissions et préférences du cockpit seront pilotés ici." primary={{ label: 'Voir les projets', href: '/projects' }} onNavigate={onNavigate} />;
}

function AuditPage() {
  return (
    <div className="page">
      <header className="topbar"><div><span className="eyebrow">Intégrité & traçabilité</span><h1>Journal d’audit</h1><p>Chaque événement est chaîné cryptographiquement au précédent.</p></div></header>
      <section className="stats">
        <article><span className="stat-icon green"><ShieldCheck /></span><div><small>Intégrité</small><strong>100%</strong><em>chaîne vérifiée</em></div></article>
        <article><span className="stat-icon blue"><Fingerprint /></span><div><small>Événements</small><strong>1 284</strong><em>depuis le 1er juin</em></div></article>
        <article><span className="stat-icon purple"><Fingerprint /></span><div><small>Dernier ancrage</small><strong>#42</strong><em>MainChain · il y a 2 h</em></div></article>
      </section>
      <section className="panel audit-explainer"><ShieldCheck size={32} /><h2>Preuves sans exposition des données</h2><p>Le détail reste dans PostgreSQL. Seules les racines Merkle périodiques sont destinées à MainChain, jamais les tickets ou les spécifications en clair.</p></section>
    </div>
  );
}

function PlaceholderPage({ eyebrow, title, description, primary, onNavigate }: { eyebrow: string; title: string; description: string; primary: { label: string; href: string }; onNavigate: (path: string) => void }) {
  return (
    <div className="page">
      <section className="panel placeholder">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <AppLink href={primary.href} className="primary" onNavigate={onNavigate}>{primary.label}<ChevronRight size={16} /></AppLink>
      </section>
    </div>
  );
}

function AppLink({ href, onNavigate, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate: (path: string) => void }) {
  return <a {...props} href={href} onClick={(event) => { if (href.startsWith('/')) { event.preventDefault(); onNavigate(href); } }}>{children}</a>;
}

function usePathname(): [string, (nextPath: string) => void] {
  const [path, setPath] = useState(`${window.location.pathname}${window.location.search}`);
  useEffect(() => {
    const listener = () => setPath(`${window.location.pathname}${window.location.search}`);
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);
  return [path, (nextPath) => { window.history.pushState({}, '', nextPath); setPath(nextPath); window.scrollTo({ top: 0 }); }];
}

function useAuthentication() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState(false);

  const refresh = () => {
    setError(false);
    setSession(null);
    void getAuthSession().then(setSession).catch(() => setError(true));
  };

  useEffect(refresh, []);

  const signOut = async () => {
    try {
      await logout();
      setSession({ authenticated: false });
    } catch {
      setError(true);
    }
  };

  return { session, error, refresh, signOut };
}

function route(pathWithSearch: string, onNavigate: (path: string) => void, login: string) {
  const url = new URL(pathWithSearch, window.location.origin);
  const path = url.pathname;
  if (path === '/') return <React.Suspense fallback={<StatePanel title="Chargement du cockpit…" description="Lecture des indicateurs persistés." />}><LazyDashboardPage onNavigate={onNavigate} /></React.Suspense>;
  if (path === '/tickets') return <React.Suspense fallback={<StatePanel title="Chargement des tickets…" description="Lecture du registre de tickets." />}><LazyTicketsPage onNavigate={onNavigate} initialFilter={url.searchParams.get('filter') === 'mine' ? 'mine' : url.searchParams.get('filter') === 'validation' ? 'validation' : 'all'} /></React.Suspense>;
  if (path === '/tickets/new') return <NewTicketPage onNavigate={onNavigate} />;
  if (path.match(/^\/tickets\/[^/]+\/specification$/)) return <SpecificationEditor id={decodeURIComponent(path.split('/')[2])} onNavigate={onNavigate} />;
  if (path.startsWith('/tickets/')) return <React.Suspense fallback={<StatePanel title="Chargement du ticket…" description="Ouverture du module de détail." />}><LazyTicketDetailPage id={decodeURIComponent(path.split('/')[2])} onNavigate={onNavigate} /></React.Suspense>;
  if (path === '/specifications') return <SpecificationsPage onNavigate={onNavigate} />;
  if (path === '/workflows') return <React.Suspense fallback={<StatePanel title="Chargement des runs…" description="Ouverture du module d’exécution." />}><LazyWorkflowsPage onNavigate={onNavigate} /></React.Suspense>;
  if (path === '/backlog') return <React.Suspense fallback={<StatePanel title="Chargement du backlog…" description="Lecture des epics et tickets persistés." />}><LazyBacklogPage initialProjectId={url.searchParams.get('projectId') ?? ''} /></React.Suspense>;
  if (path === '/approvals') return <React.Suspense fallback={<StatePanel title="Chargement des validations…" description="Ouverture du module de contrôle humain." />}><LazyApprovalsPage initialProjectId={url.searchParams.get('projectId') ?? ''} login={login} /></React.Suspense>;
  if (path === '/sessions/new') return <NewSessionPage projectId={url.searchParams.get('projectId') ?? ''} onNavigate={onNavigate} />;
  if (path.startsWith('/runs/')) return <React.Suspense fallback={<StatePanel title="Chargement du run…" description="Ouverture du module de supervision." />}><LazyRunDetailPage id={decodeURIComponent(path.split('/')[2])} projectId={url.searchParams.get('projectId') ?? ''} onNavigate={onNavigate} /></React.Suspense>;
  if (path === '/knowledge') return <React.Suspense fallback={<StatePanel title="Chargement de la Knowledge Base…" description="Lecture des feedbacks, candidats et entrées actives." />}><LazyKnowledgePage initialProjectId={url.searchParams.get('projectId') ?? ''} initialFeedbackId={url.searchParams.get('feedbackId') ?? ''} /></React.Suspense>;
  if (path === '/audit') return <AuditPage />;
  if (path === '/projects') return <React.Suspense fallback={<StatePanel title="Chargement des projets…" description="Ouverture du registre partagé." />}><LazyProjectsPage onNavigate={onNavigate} login={login} /></React.Suspense>;
  if (path === '/docs') return <DocsPage onNavigate={onNavigate} />;
  if (path === '/settings') return <SettingsPage onNavigate={onNavigate} />;
  return <PlaceholderPage eyebrow="404" title="Page introuvable" description="Cette route n’existe pas encore dans le cockpit." primary={{ label: 'Retour au dashboard', href: '/' }} onNavigate={onNavigate} />;
}

function isActive(pathWithSearch: string, href: string) {
  const path = new URL(pathWithSearch, window.location.origin).pathname;
  if (href === '/') return path === '/';
  return path === href || path.startsWith(`${href}/`);
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
