import { ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ProjectSummary } from '@software-factory/contracts';
import { getProjects } from '../../lib/data';

export default function ProjectsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void getProjects().then((items) => active && setProjects(items)).catch(() => active && setError(true));
    return () => { active = false; };
  }, []);
  return <div className="page"><header className="topbar"><div><span className="eyebrow">Registre partagé</span><h1>Projets</h1><p>Chaque projet conserve ses identifiants, dépôts et namespaces isolés.</p></div></header>
    {!projects && !error && <State title="Chargement des projets…" description="Lecture du registre PostgreSQL." />}
    {error && <State title="Registre indisponible" description="L’API n’a pas pu charger les projets." />}
    {projects && <div className="cards-list">{projects.map((project) => <article className="panel list-card" key={project.id}><div><small>Profil v{project.profileVersion} · {project.status}</small><h3>{project.name}</h3><p>{project.githubOwner}/{project.githubRepository} · projectId {project.id}</p></div><a href={`/sessions/new?projectId=${encodeURIComponent(project.id)}`} className="secondary" onClick={(event) => { event.preventDefault(); onNavigate(`/sessions/new?projectId=${encodeURIComponent(project.id)}`); }}>Nouvelle session<ArrowUpRight size={14} /></a></article>)}</div>}
  </div>;
}

function State({ title, description }: { title: string; description: string }) {
  return <section className="panel state-panel"><h2>{title}</h2><p>{description}</p></section>;
}
