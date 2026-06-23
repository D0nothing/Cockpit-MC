import type { TicketSummary } from '@vistory/contracts';

export const demoTickets: TicketSummary[] = [
  { id: 'demo-142', externalId: 142, title: 'Ajouter la rotation automatique des clés API', description: 'Renouvellement sans interruption des clés de service.', status: 'second_validation_required', riskLevel: 'critical', labels: ['security', 'backend'], repository: 'vistory-core', assignee: { id: 'alice', name: 'Alice Martin' }, updatedAt: new Date().toISOString() },
  { id: 'demo-139', externalId: 139, title: 'Optimiser le chargement du tableau de bord', description: 'Le premier affichage dépasse deux secondes.', status: 'spec_review_required', riskLevel: 'standard', labels: ['performance', 'frontend'], repository: 'vistory-core', assignee: { id: 'alice', name: 'Alice Martin' }, updatedAt: new Date(Date.now() - 36e5).toISOString() },
  { id: 'demo-137', externalId: 137, title: 'Synchroniser les commentaires GitHub', description: 'Importer les commentaires sans doublons.', status: 'assigned', riskLevel: 'standard', labels: ['github', 'integration'], repository: 'vistory-core', assignee: { id: 'marc', name: 'Marc Leroy' }, updatedAt: new Date(Date.now() - 72e5).toISOString() },
  { id: 'demo-128', externalId: 128, title: 'Améliorer les preuves de chaîne d’audit', description: 'Produire une racine Merkle vérifiable.', status: 'ci_running', riskLevel: 'sensitive', labels: ['audit', 'mainchain'], repository: 'vistory-core', assignee: { id: 'alice', name: 'Alice Martin' }, updatedAt: new Date(Date.now() - 144e5).toISOString() },
];

export function getApiUrl(path: string): string | null {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();

  if (!configuredUrl) {
    if (import.meta.env.PROD) return null;
    return `http://localhost:4000/api${path}`;
  }

  try {
    const baseUrl = new URL(configuredUrl);
    if (!['http:', 'https:'].includes(baseUrl.protocol)) return null;
    return new URL(`${baseUrl.pathname.replace(/\/$/, '')}${path}`, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function getTicket(id: string): Promise<any> {
  const fallback = demoTickets.find(t => t.id === id) ?? demoTickets[0];
  const apiUrl = getApiUrl(`/tickets/${encodeURIComponent(id)}`);
  if (!apiUrl) return fallback;

  try {
    const response = await fetch(apiUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error();
    return await response.json();
  } catch {
    return fallback;
  }
}

function toTicketSummary(row: any): TicketSummary | null {
  if (!row || typeof row !== 'object') return null;
  if (typeof row.id !== 'string' || typeof row.externalId !== 'number' || typeof row.title !== 'string') return null;
  return {
    id: row.id,
    externalId: row.externalId,
    title: row.title,
    description: typeof row.description === 'string' ? row.description : '',
    status: row.status,
    riskLevel: row.riskLevel,
    labels: Array.isArray(row.labels) ? row.labels.filter((label: unknown): label is string => typeof label === 'string') : [],
    repository: typeof row.project?.githubRepository === 'string' ? row.project.githubRepository : 'unknown',
    assignee: row.assignee && typeof row.assignee.id === 'string' && typeof row.assignee.name === 'string' ? { id: row.assignee.id, name: row.assignee.name } : null,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString(),
  };
}

export async function getTickets(): Promise<TicketSummary[]> {
  const apiUrl = getApiUrl('/tickets');
  if (!apiUrl) return demoTickets;

  try {
    const response = await fetch(apiUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error();
    const rows = await response.json();
    if (!Array.isArray(rows)) return demoTickets;
    const tickets = rows.map(toTicketSummary).filter((ticket): ticket is TicketSummary => ticket !== null);
    return tickets.length > 0 ? tickets : demoTickets;
  } catch {
    return demoTickets;
  }
}
