import type { IncomingMessage, ServerResponse } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { listAudit } from '../src/audit/audit';
import { configureCors, HttpError, readJson, sendJson } from '../src/http';
import { assignTicket, findTicket, getWorkerContext, launchWorkflow, listTickets, saveSpecification, setTicketRisk, transitionTicket, validateSpecification } from '../src/tickets/tickets';

const prisma = new PrismaClient();

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    if (configureCors(request, response)) return;

    const method = request.method ?? 'GET';
    const path = new URL(request.url ?? '/', 'http://localhost').pathname.replace(/\/$/, '') || '/';

    if (method === 'GET' && path === '/') {
      return sendJson(response, 200, { status: 'ok', service: 'vistory-api', message: 'Cockpit MC API is running. Use /api/health for health checks.', health: '/api/health' });
    }

    if (method === 'GET' && path === '/api/health') {
      return sendJson(response, 200, { status: 'ok', service: 'vistory-api', timestamp: new Date().toISOString() });
    }

    if (method === 'GET' && path === '/api/tickets') return sendJson(response, 200, await listTickets(prisma));
    if (method === 'GET' && path === '/api/audit') return sendJson(response, 200, await listAudit(prisma));

    const ticketMatch = path.match(/^\/api\/tickets\/([^/]+)(?:\/([^/]+))?$/);
    if (ticketMatch) {
      const id = decodeURIComponent(ticketMatch[1]);
      const action = ticketMatch[2];
      const actorId = headerValue(request.headers['x-actor-id']) ?? 'system';

      if (method === 'GET' && !action) return sendJson(response, 200, await findTicket(prisma, id));
      if (method === 'PATCH' && action === 'assign') return sendJson(response, 200, await assignTicket(prisma, id, await readJson(request)));
      if (method === 'PATCH' && action === 'risk') return sendJson(response, 200, await setTicketRisk(prisma, id, await readJson(request), actorId));
      if (method === 'PATCH' && action === 'status') return sendJson(response, 200, await transitionTicket(prisma, id, await readJson(request), actorId));
      if (method === 'PUT' && action === 'specification') return sendJson(response, 200, await saveSpecification(prisma, id, await readJson(request), actorId));
      if (method === 'POST' && action === 'validations') return sendJson(response, 200, await validateSpecification(prisma, id, await readJson(request)));
      if (method === 'POST' && action === 'workflows') return sendJson(response, 200, await launchWorkflow(prisma, id, await readJson(request)));
    }

    const workerMatch = path.match(/^\/api\/worker\/tickets\/([^/]+)\/context$/);
    if (method === 'GET' && workerMatch) {
      return sendJson(response, 200, await getWorkerContext(prisma, decodeURIComponent(workerMatch[1]), headerValue(request.headers.authorization)));
    }

    return sendJson(response, 404, { message: `Cannot ${method} ${path}`, error: 'Not Found', statusCode: 404 });
  } catch (error) {
    if (error instanceof HttpError) return sendJson(response, error.statusCode, { message: error.message, error: error.name, statusCode: error.statusCode });
    console.error(error);
    return sendJson(response, 500, { message: 'Internal Server Error', error: 'Internal Server Error', statusCode: 500 });
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
