import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import Link from 'next/link';
import { Activity, BookOpen, Boxes, FileCheck2, LayoutDashboard, Settings, ShieldCheck, Tickets } from 'lucide-react';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-display' });
export const metadata: Metadata = { title: 'Vistory OS', description: 'Cockpit interne de pilotage IA' };

const navigation = [
  [LayoutDashboard, 'Vue d’ensemble', '/'], [Tickets, 'Tickets', '/'], [FileCheck2, 'Spécifications', '/'],
  [Activity, 'Workflows IA', '/'], [ShieldCheck, 'Journal d’audit', '/audit'], [Boxes, 'Projets', '/'],
] as const;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body className={`${inter.variable} ${manrope.variable}`}>
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand"><span className="brand-mark">V</span><span>Vistory <b>OS</b></span></Link>
        <nav>{navigation.map(([Icon, label, href], index) => <Link href={href} className={index === 0 ? 'active' : ''} key={label}><Icon size={18}/><span>{label}</span>{label === 'Workflows IA' && <i>3</i>}</Link>)}</nav>
        <div className="sidebar-bottom"><Link href="/"><BookOpen size={18}/>Documentation</Link><Link href="/"><Settings size={18}/>Paramètres</Link><div className="profile"><span>AM</span><div><strong>Alice Martin</strong><small>Responsable projet</small></div></div></div>
      </aside>
      <main>{children}</main>
    </div>
  </body></html>;
}
