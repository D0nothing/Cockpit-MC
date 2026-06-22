import { ArrowUpRight, CheckCircle2, CircleAlert, Clock3, GitPullRequestDraft, MoreHorizontal, Search, Sparkles, TicketCheck } from 'lucide-react';
import Link from 'next/link';
import { getTickets } from '../lib/data';

const labels: Record<string, string> = { imported: 'Importé', assigned: 'Assigné', spec_review_required: 'Spec à valider', second_validation_required: 'Double validation', ready_for_ai: 'Prêt pour IA', ai_requested: 'IA demandée', ai_running: 'IA en cours', ci_running: 'CI en cours', human_review_required: 'Revue humaine', done: 'Terminé', blocked: 'Bloqué' };
const tones: Record<string, string> = { spec_review_required: 'amber', second_validation_required: 'purple', ci_running: 'blue', assigned: 'neutral', done: 'green' };

export default async function Dashboard() {
  const tickets = await getTickets();
  return <div className="page">
    <header className="topbar"><div><span className="eyebrow">Lundi 22 juin</span><h1>Bonjour Alice <span>👋</span></h1><p>Voici ce qui mérite votre attention aujourd’hui.</p></div><div className="top-actions"><button className="icon-button"><Search size={19}/></button><button className="primary"><Sparkles size={17}/>Nouveau ticket</button></div></header>
    <section className="stats">
      <article><span className="stat-icon orange"><TicketCheck/></span><div><small>Tickets actifs</small><strong>24</strong><em>+3 cette semaine</em></div></article>
      <article><span className="stat-icon purple"><CircleAlert/></span><div><small>À valider</small><strong>7</strong><em>2 critiques</em></div></article>
      <article><span className="stat-icon blue"><Sparkles/></span><div><small>Workflows IA</small><strong>3</strong><em>en cours</em></div></article>
      <article><span className="stat-icon green"><GitPullRequestDraft/></span><div><small>PR en revue</small><strong>5</strong><em>2 CI validées</em></div></article>
    </section>

    <section className="attention"><div className="section-title"><div><h2>À traiter en priorité</h2><p>Actions qui nécessitent une décision humaine</p></div><button>Tout voir <ArrowUpRight size={16}/></button></div>
      <div className="attention-grid">
        <article className="attention-card critical"><div className="card-top"><span>Critique</span><small>#142</small></div><h3>Rotation automatique des clés API</h3><p>La spécification est prête. Une seconde validation est requise avant tout lancement IA.</p><div className="card-footer"><div className="avatars"><i>AM</i><i>ML</i></div><Link href={`/tickets/${tickets[0]?.id ?? 'demo-142'}`}>Examiner <ArrowUpRight size={15}/></Link></div></article>
        <article className="attention-card review"><div className="card-top"><span>Spec à valider</span><small>#139</small></div><h3>Optimiser le chargement du dashboard</h3><p>La spécification générée contient 6 critères d’acceptation et attend votre relecture.</p><div className="card-footer"><div className="due"><Clock3 size={15}/>Il y a 1 h</div><Link href={`/tickets/${tickets[1]?.id ?? 'demo-139'}`}>Relire la spec <ArrowUpRight size={15}/></Link></div></article>
      </div>
    </section>

    <section className="ticket-section"><div className="section-title"><div><h2>Tickets récents</h2><p>Synchronisés avec GitHub Issues</p></div><div className="filters"><button className="selected">Tous</button><button>Assignés à moi</button><button>À valider</button></div></div>
      <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Projet</th><th>Statut</th><th>Risque</th><th>Assigné à</th><th>Mise à jour</th><th></th></tr></thead><tbody>{tickets.map(ticket => <tr key={ticket.id}><td><Link className="ticket-link" href={`/tickets/${ticket.id}`}><small>#{ticket.externalId}</small><strong>{ticket.title}</strong><span>{ticket.labels.map(label => <i key={label}>{label}</i>)}</span></Link></td><td><span className="repo-dot"/> {ticket.repository}</td><td><span className={`status ${tones[ticket.status] ?? 'neutral'}`}>{ticket.status === 'done' && <CheckCircle2 size={13}/>} {labels[ticket.status] ?? ticket.status}</span></td><td><span className={`risk ${ticket.riskLevel}`}>{ticket.riskLevel === 'standard' ? 'Standard' : ticket.riskLevel === 'sensitive' ? 'Sensible' : 'Critique'}</span></td><td><span className="person">{ticket.assignee?.name.slice(0, 2).toUpperCase()}</span>{ticket.assignee?.name}</td><td className="muted">{new Intl.RelativeTimeFormat('fr', { numeric: 'auto' }).format(-Math.max(1, Math.round((Date.now() - new Date(ticket.updatedAt).getTime()) / 36e5)), 'hour')}</td><td><MoreHorizontal size={18}/></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
