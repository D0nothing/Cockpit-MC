import { Activity, ArrowUpRight, CheckCircle2, CircleAlert, Clock3, MoreHorizontal, Search, Sparkles, TicketCheck } from 'lucide-react';
import type { TicketSummary } from '@software-factory/contracts';
import { useEffect, useState } from 'react';
import { demoTickets, getTickets } from '../../lib/data';

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

export function DashboardPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { tickets, query, setQuery, filteredTickets } = useTickets('all');
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <div className="page">
      <header className="topbar">
        <div><span className="eyebrow">Cockpit privé</span><h1>Vistory OS</h1><p>Voici ce qui mérite votre attention aujourd’hui.</p></div>
        <div className="top-actions"><button className="icon-button" type="button" aria-label="Rechercher" onClick={() => setSearchOpen((value) => !value)}><Search size={19} /></button><a href="/sessions/new" className="primary" onClick={(event) => { event.preventDefault(); onNavigate('/sessions/new'); }}><Sparkles size={17} />Nouvelle session</a></div>
      </header>
      {searchOpen && <SearchPanel query={query} setQuery={setQuery} count={filteredTickets.length} />}
      <Stats tickets={tickets} />
      <PriorityCards tickets={tickets} onNavigate={onNavigate} />
      <TicketSection tickets={filteredTickets} filter="all" setFilter={(filter) => onNavigate(filter === 'all' ? '/tickets' : `/tickets?filter=${filter}`)} onNavigate={onNavigate} />
    </div>
  );
}

export function TicketsPage({ onNavigate, initialFilter }: { onNavigate: (path: string) => void; initialFilter: Filter }) {
  const { filteredTickets, filter, setFilter, query, setQuery } = useTickets(initialFilter);
  return (
    <div className="page">
      <header className="topbar"><div><span className="eyebrow">Pilotage</span><h1>Tickets</h1><p>Liste consolidée des tickets prêts à être cadrés, validés ou exécutés.</p></div><a href="/tickets/new" className="primary" onClick={(event) => { event.preventDefault(); onNavigate('/tickets/new'); }}><Sparkles size={17} />Nouveau ticket</a></header>
      <SearchPanel query={query} setQuery={setQuery} count={filteredTickets.length} />
      <TicketSection tickets={filteredTickets} filter={filter} setFilter={setFilter} onNavigate={onNavigate} />
    </div>
  );
}

function Stats({ tickets }: { tickets: TicketSummary[] }) {
  const awaitingValidation = tickets.filter(({ status }) => ['spec_review_required', 'second_validation_required'].includes(status)).length;
  const active = tickets.filter(({ status }) => status !== 'done').length;
  return <section className="stats"><article><span className="stat-icon orange"><TicketCheck /></span><div><small>Tickets actifs</small><strong>{active}</strong><em>état PostgreSQL</em></div></article><article><span className="stat-icon purple"><CircleAlert /></span><div><small>À valider</small><strong>{awaitingValidation}</strong><em>contrôle humain</em></div></article><article><span className="stat-icon blue"><Sparkles /></span><div><small>Capacités</small><strong>{new Set(tickets.flatMap(({ labels }) => labels)).size}</strong><em>labels actifs</em></div></article><article><span className="stat-icon green"><Activity /></span><div><small>Terminés</small><strong>{tickets.length - active}</strong><em>preuves disponibles</em></div></article></section>;
}

function PriorityCards({ tickets, onNavigate }: { tickets: TicketSummary[]; onNavigate: (path: string) => void }) {
  const priorities = tickets.filter(({ status }) => ['spec_review_required', 'second_validation_required'].includes(status)).slice(0, 2);
  return <section className="attention"><div className="section-title"><div><h2>À traiter en priorité</h2><p>Actions qui nécessitent une décision humaine</p></div><a href="/tickets?filter=validation" className="text-link" onClick={(event) => { event.preventDefault(); onNavigate('/tickets?filter=validation'); }}>Tout voir <ArrowUpRight size={16} /></a></div><div className="attention-grid">{priorities.map((ticket) => <article className={`attention-card ${ticket.riskLevel === 'critical' ? 'critical' : 'review'}`} key={ticket.id}><div className="card-top"><span>{labels[ticket.status] ?? ticket.status}</span><small>#{ticket.externalId}</small></div><h3>{ticket.title}</h3><p>{ticket.description}</p><div className="card-footer"><div className="due"><Clock3 size={15} />{relativeHour(ticket.updatedAt)}</div><a href={`/tickets/${ticket.id}`} onClick={(event) => { event.preventDefault(); onNavigate(`/tickets/${ticket.id}`); }}>Examiner <ArrowUpRight size={15} /></a></div></article>)}</div></section>;
}

function TicketSection({ tickets, filter, setFilter, onNavigate }: { tickets: TicketSummary[]; filter: Filter; setFilter: (filter: Filter) => void; onNavigate: (path: string) => void }) {
  return <section className="ticket-section"><div className="section-title"><div><h2>Tickets récents</h2><p>État persistant du projet</p></div><div className="filters"><button className={filter === 'all' ? 'selected' : ''} type="button" onClick={() => setFilter('all')}>Tous</button><button className={filter === 'mine' ? 'selected' : ''} type="button" onClick={() => setFilter('mine')}>Assignés à moi</button><button className={filter === 'validation' ? 'selected' : ''} type="button" onClick={() => setFilter('validation')}>À valider</button></div></div><div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Projet</th><th>Statut</th><th>Risque</th><th>Assigné à</th><th>Mise à jour</th><th>Action</th></tr></thead><tbody>{tickets.map((ticket) => <TicketRow ticket={ticket} key={ticket.id} onNavigate={onNavigate} />)}</tbody></table></div></section>;
}

function TicketRow({ ticket, onNavigate }: { ticket: TicketSummary; onNavigate: (path: string) => void }) {
  return <tr><td><a className="ticket-link" href={`/tickets/${ticket.id}`} onClick={(event) => { event.preventDefault(); onNavigate(`/tickets/${ticket.id}`); }}><small>#{ticket.externalId}</small><strong>{ticket.title}</strong><span>{ticket.labels.map((label) => <i key={label}>{label}</i>)}</span></a></td><td><span className="repo-dot" /> {ticket.repository}</td><td><span className={`status ${tones[ticket.status] ?? 'neutral'}`}>{ticket.status === 'done' && <CheckCircle2 size={13} />} {labels[ticket.status] ?? ticket.status}</span></td><td><span className={`risk ${ticket.riskLevel}`}>{ticket.riskLevel === 'standard' ? 'Standard' : ticket.riskLevel === 'sensitive' ? 'Sensible' : 'Critique'}</span></td><td><span className="person">{ticket.assignee?.name.slice(0, 2).toUpperCase()}</span>{ticket.assignee?.name ?? 'Non assigné'}</td><td className="muted">{relativeHour(ticket.updatedAt)}</td><td><a href={`/tickets/${ticket.id}`} className="icon-link" aria-label={`Ouvrir ${ticket.title}`} onClick={(event) => { event.preventDefault(); onNavigate(`/tickets/${ticket.id}`); }}><MoreHorizontal size={18} /></a></td></tr>;
}

function SearchPanel({ query, setQuery, count }: { query: string; setQuery: (query: string) => void; count: number }) {
  return <div className="search-panel"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un titre, label, statut ou dépôt…" /><span>{count} résultat(s)</span></div>;
}

function useTickets(initialFilter: Filter) {
  const [tickets, setTickets] = useState<TicketSummary[]>(demoTickets);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState('');
  useEffect(() => { void getTickets().then(setTickets); }, []);
  const filteredTickets = tickets.filter((ticket) => {
    const matchesFilter = filter === 'all' || (filter === 'mine' && ticket.assignee?.name === 'Alice Martin') || (filter === 'validation' && ['spec_review_required', 'second_validation_required'].includes(ticket.status));
    return matchesFilter && `${ticket.title} ${ticket.description} ${ticket.repository} ${ticket.status} ${ticket.labels.join(' ')}`.toLowerCase().includes(query.toLowerCase());
  });
  return { tickets, filteredTickets, filter, setFilter, query, setQuery };
}

function relativeHour(updatedAt: string) {
  return new Intl.RelativeTimeFormat('fr', { numeric: 'auto' }).format(-Math.max(1, Math.round((Date.now() - new Date(updatedAt).getTime()) / 36e5)), 'hour');
}
