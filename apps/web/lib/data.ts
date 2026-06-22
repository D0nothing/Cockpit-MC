import type { TicketSummary } from '@vistory/contracts';

export const demoTickets: TicketSummary[] = [
  { id: 'demo-142', externalId: 142, title: 'Ajouter la rotation automatique des clés API', description: 'Renouvellement sans interruption des clés de service.', status: 'second_validation_required', riskLevel: 'critical', labels: ['security', 'backend'], repository: 'vistory-core', assignee: { id: 'alice', name: 'Alice Martin' }, updatedAt: new Date().toISOString() },
  { id: 'demo-139', externalId: 139, title: 'Optimiser le chargement du tableau de bord', description: 'Le premier affichage dépasse deux secondes.', status: 'spec_review_required', riskLevel: 'standard', labels: ['performance', 'frontend'], repository: 'vistory-core', assignee: { id: 'alice', name: 'Alice Martin' }, updatedAt: new Date(Date.now() - 36e5).toISOString() },
  { id: 'demo-137', externalId: 137, title: 'Synchroniser les commentaires GitHub', description: 'Importer les commentaires sans doublons.', status: 'assigned', riskLevel: 'standard', labels: ['github', 'integration'], repository: 'vistory-core', assignee: { id: 'marc', name: 'Marc Leroy' }, updatedAt: new Date(Date.now() - 72e5).toISOString() },
  { id: 'demo-128', externalId: 128, title: 'Améliorer les preuves de chaîne d’audit', description: 'Produire une racine Merkle vérifiable.', status: 'ci_running', riskLevel: 'sensitive', labels: ['audit', 'mainchain'], repository: 'vistory-core', assignee: { id: 'alice', name: 'Alice Martin' }, updatedAt: new Date(Date.now() - 144e5).toISOString() },
];

export async function getTickets(): Promise<TicketSummary[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/tickets`, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const rows = await response.json();
    return rows.map((row: any) => ({ ...row, repository: row.project.githubRepository }));
  } catch { return demoTickets; }
}
