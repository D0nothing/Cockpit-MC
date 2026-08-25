import { PrismaClient, Role } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const [alice, marc] = await Promise.all([
    prisma.user.upsert({ where: { email: 'alice@factory.internal' }, update: {}, create: { email: 'alice@factory.internal', name: 'Alice Martin', role: Role.ASSIGNEE } }),
    prisma.user.upsert({ where: { email: 'marc@factory.internal' }, update: {}, create: { email: 'marc@factory.internal', name: 'Marc Leroy', role: Role.SECONDARY_VALIDATOR } }),
  ]);
  const project = await prisma.project.upsert({
    where: { slug: 'factory-demo' },
    update: { legalEntityId: 'entity-vistory', memoryNamespace: 'factory-demo-memory', knowledgeNamespace: 'factory-demo-kb' },
    create: {
      name: 'Factory Demo',
      slug: 'factory-demo',
      legalEntityId: 'entity-vistory',
      memoryNamespace: 'factory-demo-memory',
      knowledgeNamespace: 'factory-demo-kb',
      githubOwner: 'acme',
      githubRepository: 'factory-demo',
      confluenceSpaceKey: 'FDEMO',
    },
  });
  await prisma.project.upsert({
    where: { slug: 'project-beta' },
    update: { legalEntityId: 'entity-beta', memoryNamespace: 'project-beta-memory', knowledgeNamespace: 'project-beta-kb' },
    create: {
      name: 'Projet Bêta',
      slug: 'project-beta',
      legalEntityId: 'entity-beta',
      memoryNamespace: 'project-beta-memory',
      knowledgeNamespace: 'project-beta-kb',
      githubOwner: 'example',
      githubRepository: 'project-beta',
    },
  });
  const examples = [
    { externalId: 142, title: 'Ajouter la rotation automatique des clés API', description: 'Les clés de service doivent pouvoir être renouvelées sans interruption.', labels: ['security', 'backend'], status: 'second_validation_required' as const, riskLevel: 'critical' as const, assigneeId: alice.id },
    { externalId: 139, title: 'Optimiser le chargement du tableau de bord', description: 'Le premier affichage dépasse deux secondes avec plus de 500 tickets.', labels: ['performance', 'frontend'], status: 'spec_review_required' as const, riskLevel: 'standard' as const, assigneeId: alice.id },
    { externalId: 137, title: 'Synchroniser les commentaires GitHub', description: 'Importer les nouveaux commentaires sans dupliquer les données.', labels: ['github', 'integration'], status: 'assigned' as const, riskLevel: 'standard' as const, assigneeId: marc.id },
    { externalId: 128, title: 'Améliorer les preuves de chaîne d’audit', description: 'Produire une racine Merkle vérifiable pour chaque lot.', labels: ['audit', 'mainchain'], status: 'ci_running' as const, riskLevel: 'sensitive' as const, assigneeId: alice.id },
  ];
  for (const item of examples) {
    const ticket = await prisma.ticket.upsert({ where: { projectId_externalId: { projectId: project.id, externalId: item.externalId } }, update: {}, create: { ...item, projectId: project.id, sourceUrl: `https://github.com/acme/factory-demo/issues/${item.externalId}` } });
    if (item.externalId === 139 || item.externalId === 142) await prisma.specification.upsert({ where: { ticketId: ticket.id }, update: {}, create: { ticketId: ticket.id, content: `# Objectif\n\n${item.description}\n\n## Critères d’acceptation\n\n- Tests automatisés ajoutés\n- Aucun secret exposé\n- Déploiement réversible`, generatedFromHash: 'seed', status: item.externalId === 142 ? 'VALIDATED' : 'REVIEW_REQUIRED' } });
  }
}
main().finally(() => prisma.$disconnect());
