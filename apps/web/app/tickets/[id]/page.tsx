import { ArrowLeft, Check, ChevronRight, Circle, ExternalLink, FileText, Github, ShieldAlert, Sparkles, UserRound } from 'lucide-react';
import Link from 'next/link';
import { demoTickets } from '../../../lib/data';

async function getTicket(id: string) {
  try { const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/tickets/${id}`, { cache: 'no-store' }); if (!r.ok) throw new Error(); return await r.json(); }
  catch { return demoTickets.find(t => t.id === id) ?? demoTickets[0]; }
}

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const ticket = await getTicket(id);
  const spec = ticket.specification?.content ?? `# Objectif\n\n${ticket.description}\n\n## Critères d’acceptation\n\n- La fonctionnalité est couverte par des tests automatisés\n- Aucun secret n’est exposé au navigateur\n- Le changement peut être déployé et annulé sans interruption\n\n## Hors périmètre\n\n- Merge automatique\n- Modification des droits de production`;
  return <div className="page detail-page">
    <Link href="/" className="back"><ArrowLeft size={16}/>Retour aux tickets</Link>
    <header className="detail-header"><div><div className="detail-meta"><span>#{ticket.externalId}</span><span className={`risk ${ticket.riskLevel}`}>{ticket.riskLevel}</span><span>vistory-core</span></div><h1>{ticket.title}</h1><p>{ticket.description}</p></div><a className="secondary" href={ticket.sourceUrl ?? '#'}><Github size={17}/>Voir sur GitHub<ExternalLink size={14}/></a></header>
    <div className="detail-grid">
      <div className="detail-main">
        <section className="panel workflow-panel"><div className="panel-title"><div><Sparkles size={19}/><h2>Progression</h2></div><span>4 / 7 étapes</span></div><div className="steps">
          {['Ticket importé', 'Contexte consolidé', 'Spécification générée', 'Validation principale', 'Seconde validation', 'Exécution Codex', 'Revue humaine'].map((step, i) => <div className={i < 4 ? 'complete' : i === 4 ? 'current' : ''} key={step}><span>{i < 4 ? <Check size={14}/> : <Circle size={12}/>}</span><small>{step}</small>{i < 6 && <i/>}</div>)}
        </div></section>
        <section className="panel spec-panel"><div className="panel-title"><div><FileText size={19}/><h2>Spécification technique</h2><span className="version">v{ticket.specification?.version ?? 1}</span></div><button>Modifier</button></div><div className="markdown">{spec.split('\n').map((line: string, index: number) => line.startsWith('# ') ? <h2 key={index}>{line.slice(2)}</h2> : line.startsWith('## ') ? <h3 key={index}>{line.slice(3)}</h3> : line.startsWith('- ') ? <p className="bullet" key={index}>✓ {line.slice(2)}</p> : line ? <p key={index}>{line}</p> : null)}</div></section>
      </div>
      <aside className="detail-side">
        <section className="panel decision"><div className="decision-head"><ShieldAlert size={21}/><div><h3>Validation requise</h3><p>Ticket classé {ticket.riskLevel}</p></div></div><p>Une seconde personne doit approuver cette spécification avant que Codex puisse être lancé.</p><div className="validator"><span>AM</span><div><strong>Alice Martin</strong><small>Validation principale · approuvée</small></div><Check size={17}/></div><div className="validator pending"><span>ML</span><div><strong>Marc Leroy</strong><small>Validation secondaire · en attente</small></div><Circle size={15}/></div><button className="primary full">Approuver la spécification<ChevronRight size={16}/></button><button className="text-button">Demander des modifications</button></section>
        <section className="panel properties"><h3>Informations</h3><dl><div><dt><UserRound size={15}/>Assigné à</dt><dd>Alice Martin</dd></div><div><dt>Risque</dt><dd><span className={`risk ${ticket.riskLevel}`}>{ticket.riskLevel}</span></dd></div><div><dt>Labels</dt><dd>{ticket.labels.map((x: string) => <i key={x}>{x}</i>)}</dd></div><div><dt>Branche IA</dt><dd>Créée après validation</dd></div></dl></section>
      </aside>
    </div>
  </div>;
}
