import { apiRequest, array, integer, object, string, strings } from './data';

export interface BacklogTicket {
  id: string;
  externalId: number;
  title: string;
  status: string;
  capability: string;
  complexity: string;
  dependsOn: string[];
  acceptanceCriteria: string[];
}

export interface BacklogEpic {
  id: string;
  key: string;
  title: string;
  objective: string;
  expectedOutcome: string;
  status: string;
  sequence: number;
  session: { id: string; objective: string; state: string; riskLevel: string };
  tickets: BacklogTicket[];
}

export async function getBacklog(projectId: string): Promise<BacklogEpic[]> {
  const value = await apiRequest(`/projects/${encodeURIComponent(projectId)}/backlog`);
  return array(value, 'Backlog').map((epicValue) => {
    const epic = object(epicValue, 'Backlog.epic');
    const session = object(epic.session, 'Backlog.epic.session');
    return {
      id: string(epic.id, 'Backlog.epic.id'),
      key: string(epic.key, 'Backlog.epic.key'),
      title: string(epic.title, 'Backlog.epic.title'),
      objective: string(epic.objective, 'Backlog.epic.objective'),
      expectedOutcome: string(epic.expectedOutcome, 'Backlog.epic.expectedOutcome'),
      status: string(epic.status, 'Backlog.epic.status'),
      sequence: integer(epic.sequence, 'Backlog.epic.sequence'),
      session: { id: string(session.id, 'Backlog.epic.session.id'), objective: string(session.objective, 'Backlog.epic.session.objective'), state: string(session.state, 'Backlog.epic.session.state'), riskLevel: string(session.riskLevel, 'Backlog.epic.session.riskLevel') },
      tickets: array(epic.tickets, 'Backlog.epic.tickets').map((ticketValue) => {
        const ticket = object(ticketValue, 'Backlog.ticket');
        return {
          id: string(ticket.id, 'Backlog.ticket.id'),
          externalId: integer(ticket.externalId, 'Backlog.ticket.externalId'),
          title: string(ticket.title, 'Backlog.ticket.title'),
          status: string(ticket.status, 'Backlog.ticket.status'),
          capability: string(ticket.capability, 'Backlog.ticket.capability'),
          complexity: string(ticket.complexity, 'Backlog.ticket.complexity'),
          dependsOn: strings(ticket.dependsOn, 'Backlog.ticket.dependsOn'),
          acceptanceCriteria: strings(ticket.acceptanceCriteria, 'Backlog.ticket.acceptanceCriteria'),
        };
      }),
    };
  });
}
