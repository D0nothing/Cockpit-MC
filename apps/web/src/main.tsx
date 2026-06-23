import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  Fingerprint,
  GitPullRequestDraft,
  Github,
  LayoutDashboard,
  Link2,
  MoreHorizontal,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Tickets,
  UserRound,
} from 'lucide-react';
import type { TicketSummary } from '@vistory/contracts';
import { demoTickets, getTicket, getTickets } from '../lib/data';
import '../app/globals.css';

type Filter = 'all' | 'mine' | 'validation';

const labels: Record<string, string> = {
  imported: 'Importé',
  assigned: 'Assigné',
  spec_review_required: 'Spec à valider',
  second_validation_required: 'Double validation',
  ready_for_ai: 'Prêt pour IA',
  ai_requested: 'IA demandée',
  ai_running: 'IA en cours',
  ci_running: 'CI en cours',
  human_review_required: 'Revue humaine',
  done: 'Terminé',
  blocked: 'Bloqué',
};

const tones: Record<string, string> = {
  spec_review_required: 'amber',
  second_validation_required: 'purple',
  ci_running: 'blue',
  assigned: 'neutral',
  done: 'green',
};

const navigation = [
  [LayoutDashboard, 'Vue d’ensemble', '/'],
  [Tickets, 'Tickets', '/tickets'],
  [FileCheck2, 'Spécifications', '/specifications'],
  [Activity, 'Workflows IA', '/workflows'],
  [ShieldCheck, 'Journal d’audit', '/audit'],
  [Boxes, 'Projets', '/projects'],
] as const;

function App() {
  const [path, setPath] = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <AppLink href="/" className="brand" onNavigate={setPath}>
          <span className="brand-mark">V</span>
          <span>Vistory <b>OS</b></span>
        </AppLink>
        <nav>
          {navigation.map(([Icon, label, href]) => (
            <AppLink href={href} className={isActive(path, href) ? 'active' : ''} key={label} onNavigate={setPath}>
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Workflows IA' && <i>3</i>}
            </AppLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <AppLink href="/docs" onNavigate={setPath}><BookOpen size={18} />Documentation</AppLink>
          <AppLink href="/settings" onNavigate={setPath}><Settings size={18} />Paramètres</AppLink>
          <div className="profile"><span>AM</span><div><strong>Alice Martin</strong><small>Responsable projet</small></div></div>
        </div>
      </aside>
      <main>{route(path, setPath)}</main>
    </div>
  );
}

function Dashboard({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { tickets, query, setQuery, filteredTickets } = useTickets('all');
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Mardi 23 juin</span>
          <h1>Bonjour Alice <span>👋</span></h1>
          <p>Voici ce qui mérite votre attention aujourd’hui.</p>
        </div>
        <div className="top-actions">
          <button className="icon-button" type="button" aria-label="Rechercher" onClick={() => setSearchOpen((value) => !value)}><Search size={19} /></button>
          <AppLink href="/tickets/new" className="primary" onNavigate={onNavigate}><Sparkles size={17} />Nouveau ticket</AppLink>
        </div>
      </header>

      {searchOpen && <SearchPanel query={query} setQuery={setQuery} count={filteredTickets.length} />}
      <Stats />
      <PriorityCards tickets={tickets} onNavigate={onNavigate} />
      <TicketSection tickets={filteredTickets} filter="all" setFilter={(filter) => onNavigate(filter === 'all' ? '/tickets' : `/tickets?filter=${filter}`)} onNavigate={onNavigate} />
    </div>
  );
}

function TicketsPage({ onNavigate, initialFilter }: { onNavigate: (path: string) => void; initialFilter: Filter }) {
  const { filteredTickets, filter, setFilter, query, setQuery } = useTickets(initialFilter);
  return (
    <div className="page">
      <header className="topbar">
        <div><span className="eyebrow">Pilotage</span><h1>Tickets</h1><p>Liste consolidée des tickets prêts à être cadrés, validés ou exécutés.</p></div>
        <AppLink href="/tickets/new" className="primary" onNavigate={onNavigate}><Sparkles size={17} />Nouveau ticket</AppLink>
      </header>
      <SearchPanel query={query} setQuery={setQuery} count={filteredTickets.length} />
      <TicketSection tickets={filteredTickets} filter={filter} setFilter={setFilter} onNavigate={onNavigate} />
    </div>
  );
}

function TicketDetail({ id, onNavigate }: { id: string; onNavigate: (path: string) => void }) {
  const [ticket, setTicket] = useState<any>(demoTickets.find((item) => item.id === id) ?? demoTickets[0]);
  const [notice, setNotice] = useState('');

  useEffect(() => { void getTicket(id).then(setTicket); }, [id]);

  const spec = useMemo(() => ticket.specification?.content ?? `# Objectif\n\n${ticket.description}\n\n## Critères d’acceptation\n\n- La fonctionnalité est couverte par des tests automatisés\n- Aucun secret n’est exposé au navigateur\n- Le changement peut être déployé et annulé sans interruption\n\n## Hors périmètre\n\n- Merge automatique\n- Modification des droits de production`, [ticket]);

  return (
    <div className="page detail-page">
      <AppLink href="/tickets" className="back" onNavigate={onNavigate}><ArrowLeft size={16} />Retour aux tickets</AppLink>
      {notice && <div className="notice success">{notice}</div>}
      <header className="detail-header">
        <div>
          <div className="detail-meta"><span>#{ticket.externalId}</span><span className={`risk ${ticket.riskLevel}`}>{ticket.riskLevel}</span><span>{ticket.repository ?? 'vistory-core'}</span></div>
          <h1>{ticket.title}</h1>
          <p>{ticket.description}</p>
        </div>
        {ticket.sourceUrl ? (
          <a className="secondary" href={ticket.sourceUrl} target="_blank" rel="noreferrer"><Github size={17} />Voir sur GitHub<ExternalLink size={14} /></a>
        ) : (
          <span className="secondary disabled"><Github size={17} />Lien GitHub indisponible</span>
        )}
      </header>
      <div className="detail-grid">
        <div className="detail-main">
          <WorkflowProgress />
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
            <button className="primary full" type="button" onClick={() => setNotice('Validation enregistrée localement. Connectez PostgreSQL pour persister l’action.')}><Check size={16} />Approuver la spécification</button>
            <button className="text-button" type="button" onClick={() => setNotice('Demande de modifications préparée. Le workflow API pourra l’enregistrer quand la base sera connectée.')}>Demander des modifications</button>
          </section>
          <Properties ticket={ticket} />
        </aside>
      </div>
    </div>
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

function WorkflowsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <PlaceholderPage eyebrow="Automatisation" title="Workflows IA" description="Les workflows Codex seront listés ici avec leur branche, statut CI et rapport d’agent." primary={{ label: 'Voir les tickets prêts', href: '/tickets?filter=validation' }} onNavigate={onNavigate} />;
}

function ProjectsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <PlaceholderPage eyebrow="Portefeuille" title="Projets" description="Configuration des dépôts GitHub, espaces Confluence et règles de double validation." primary={{ label: 'Retour au dashboard', href: '/' }} onNavigate={onNavigate} />;
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
        <article><span className="stat-icon purple"><Link2 /></span><div><small>Dernier ancrage</small><strong>#42</strong><em>MainChain · il y a 2 h</em></div></article>
      </section>
      <section className="panel audit-explainer"><ShieldCheck size={32} /><h2>Preuves sans exposition des données</h2><p>Le détail reste dans PostgreSQL. Seules les racines Merkle périodiques sont destinées à MainChain, jamais les tickets ou les spécifications en clair.</p></section>
    </div>
  );
}

function Stats() {
  return (
    <section className="stats">
      <article><span className="stat-icon orange"><TicketCheck /></span><div><small>Tickets actifs</small><strong>24</strong><em>+3 cette semaine</em></div></article>
      <article><span className="stat-icon purple"><CircleAlert /></span><div><small>À valider</small><strong>7</strong><em>2 critiques</em></div></article>
      <article><span className="stat-icon blue"><Sparkles /></span><div><small>Workflows IA</small><strong>3</strong><em>en cours</em></div></article>
      <article><span className="stat-icon green"><GitPullRequestDraft /></span><div><small>PR en revue</small><strong>5</strong><em>2 CI validées</em></div></article>
    </section>
  );
}

function PriorityCards({ tickets, onNavigate }: { tickets: TicketSummary[]; onNavigate: (path: string) => void }) {
  return (
    <section className="attention">
      <div className="section-title"><div><h2>À traiter en priorité</h2><p>Actions qui nécessitent une décision humaine</p></div><AppLink href="/tickets?filter=validation" className="text-link" onNavigate={onNavigate}>Tout voir <ArrowUpRight size={16} /></AppLink></div>
      <div className="attention-grid">
        <article className="attention-card critical"><div className="card-top"><span>Critique</span><small>#142</small></div><h3>Rotation automatique des clés API</h3><p>La spécification est prête. Une seconde validation est requise avant tout lancement IA.</p><div className="card-footer"><div className="avatars"><i>AM</i><i>ML</i></div><AppLink href={`/tickets/${tickets[0]?.id ?? 'demo-142'}`} onNavigate={onNavigate}>Examiner <ArrowUpRight size={15} /></AppLink></div></article>
        <article className="attention-card review"><div className="card-top"><span>Spec à valider</span><small>#139</small></div><h3>Optimiser le chargement du dashboard</h3><p>La spécification générée contient 6 critères d’acceptation et attend votre relecture.</p><div className="card-footer"><div className="due"><Clock3 size={15} />Il y a 1 h</div><AppLink href={`/tickets/${tickets[1]?.id ?? 'demo-139'}`} onNavigate={onNavigate}>Relire la spec <ArrowUpRight size={15} /></AppLink></div></article>
      </div>
    </section>
  );
}

function TicketSection({ tickets, filter, setFilter, onNavigate }: { tickets: TicketSummary[]; filter: Filter; setFilter: (filter: Filter) => void; onNavigate: (path: string) => void }) {
  return (
    <section className="ticket-section">
      <div className="section-title"><div><h2>Tickets récents</h2><p>Synchronisés avec GitHub Issues</p></div><div className="filters"><button className={filter === 'all' ? 'selected' : ''} type="button" onClick={() => setFilter('all')}>Tous</button><button className={filter === 'mine' ? 'selected' : ''} type="button" onClick={() => setFilter('mine')}>Assignés à moi</button><button className={filter === 'validation' ? 'selected' : ''} type="button" onClick={() => setFilter('validation')}>À valider</button></div></div>
      <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Projet</th><th>Statut</th><th>Risque</th><th>Assigné à</th><th>Mise à jour</th><th>Action</th></tr></thead><tbody>{tickets.map((ticket) => <TicketRow ticket={ticket} key={ticket.id} onNavigate={onNavigate} />)}</tbody></table></div>
    </section>
  );
}

function TicketRow({ ticket, onNavigate }: { ticket: TicketSummary; onNavigate: (path: string) => void }) {
  return (
    <tr>
      <td><AppLink className="ticket-link" href={`/tickets/${ticket.id}`} onNavigate={onNavigate}><small>#{ticket.externalId}</small><strong>{ticket.title}</strong><span>{ticket.labels.map((label) => <i key={label}>{label}</i>)}</span></AppLink></td>
      <td><span className="repo-dot" /> {ticket.repository}</td>
      <td><span className={`status ${tones[ticket.status] ?? 'neutral'}`}>{ticket.status === 'done' && <CheckCircle2 size={13} />} {labels[ticket.status] ?? ticket.status}</span></td>
      <td><span className={`risk ${ticket.riskLevel}`}>{ticket.riskLevel === 'standard' ? 'Standard' : ticket.riskLevel === 'sensitive' ? 'Sensible' : 'Critique'}</span></td>
      <td><span className="person">{ticket.assignee?.name.slice(0, 2).toUpperCase()}</span>{ticket.assignee?.name ?? 'Non assigné'}</td>
      <td className="muted">{relativeHour(ticket.updatedAt)}</td>
      <td><AppLink href={`/tickets/${ticket.id}`} className="icon-link" aria-label={`Ouvrir ${ticket.title}`} onNavigate={onNavigate}><MoreHorizontal size={18} /></AppLink></td>
    </tr>
  );
}

function SearchPanel({ query, setQuery, count }: { query: string; setQuery: (query: string) => void; count: number }) {
  return <div className="search-panel"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un titre, label, statut ou dépôt…" /><span>{count} résultat(s)</span></div>;
}

function WorkflowProgress() {
  return (
    <section className="panel workflow-panel">
      <div className="panel-title"><div><Sparkles size={19} /><h2>Progression</h2></div><span>4 / 7 étapes</span></div>
      <div className="steps">{['Ticket importé', 'Contexte consolidé', 'Spécification générée', 'Validation principale', 'Seconde validation', 'Exécution Codex', 'Revue humaine'].map((step, i) => <div className={i < 4 ? 'complete' : i === 4 ? 'current' : ''} key={step}><span>{i < 4 ? <Check size={14} /> : <Circle size={12} />}</span><small>{step}</small>{i < 6 && <i />}</div>)}</div>
    </section>
  );
}

function Properties({ ticket }: { ticket: any }) {
  return (
    <section className="panel properties">
      <h3>Informations</h3>
      <dl><div><dt><UserRound size={15} />Assigné à</dt><dd>{ticket.assignee?.name ?? 'Non assigné'}</dd></div><div><dt>Risque</dt><dd><span className={`risk ${ticket.riskLevel}`}>{ticket.riskLevel}</span></dd></div><div><dt>Labels</dt><dd>{ticket.labels.map((x: string) => <i key={x}>{x}</i>)}</dd></div><div><dt>Branche IA</dt><dd>Créée après validation</dd></div></dl>
    </section>
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

function useTickets(initialFilter: Filter) {
  const [tickets, setTickets] = useState<TicketSummary[]>(demoTickets);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState('');
  useEffect(() => { void getTickets().then(setTickets); }, []);
  const filteredTickets = tickets.filter((ticket) => {
    const matchesFilter = filter === 'all' || (filter === 'mine' && ticket.assignee?.name === 'Alice Martin') || (filter === 'validation' && ['spec_review_required', 'second_validation_required'].includes(ticket.status));
    const haystack = `${ticket.title} ${ticket.description} ${ticket.repository} ${ticket.status} ${ticket.labels.join(' ')}`.toLowerCase();
    return matchesFilter && haystack.includes(query.toLowerCase());
  });
  return { tickets, filteredTickets, filter, setFilter, query, setQuery };
}

function route(pathWithSearch: string, onNavigate: (path: string) => void) {
  const url = new URL(pathWithSearch, window.location.origin);
  const path = url.pathname;
  if (path === '/') return <Dashboard onNavigate={onNavigate} />;
  if (path === '/tickets') return <TicketsPage onNavigate={onNavigate} initialFilter={(url.searchParams.get('filter') as Filter) || 'all'} />;
  if (path === '/tickets/new') return <NewTicketPage onNavigate={onNavigate} />;
  if (path.match(/^\/tickets\/[^/]+\/specification$/)) return <SpecificationEditor id={decodeURIComponent(path.split('/')[2])} onNavigate={onNavigate} />;
  if (path.startsWith('/tickets/')) return <TicketDetail id={decodeURIComponent(path.split('/')[2])} onNavigate={onNavigate} />;
  if (path === '/specifications') return <SpecificationsPage onNavigate={onNavigate} />;
  if (path === '/workflows') return <WorkflowsPage onNavigate={onNavigate} />;
  if (path === '/audit') return <AuditPage />;
  if (path === '/projects') return <ProjectsPage onNavigate={onNavigate} />;
  if (path === '/docs') return <DocsPage onNavigate={onNavigate} />;
  if (path === '/settings') return <SettingsPage onNavigate={onNavigate} />;
  return <PlaceholderPage eyebrow="404" title="Page introuvable" description="Cette route n’existe pas encore dans le cockpit." primary={{ label: 'Retour au dashboard', href: '/' }} onNavigate={onNavigate} />;
}

function isActive(pathWithSearch: string, href: string) {
  const path = new URL(pathWithSearch, window.location.origin).pathname;
  if (href === '/') return path === '/';
  return path === href || path.startsWith(`${href}/`);
}

function renderMarkdown(spec: string) {
  return spec.split('\n').map((line, index) => line.startsWith('# ') ? <h2 key={index}>{line.slice(2)}</h2> : line.startsWith('## ') ? <h3 key={index}>{line.slice(3)}</h3> : line.startsWith('- ') ? <p className="bullet" key={index}>✓ {line.slice(2)}</p> : line ? <p key={index}>{line}</p> : null);
}

function relativeHour(updatedAt: string) {
  return new Intl.RelativeTimeFormat('fr', { numeric: 'auto' }).format(-Math.max(1, Math.round((Date.now() - new Date(updatedAt).getTime()) / 36e5)), 'hour');
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
