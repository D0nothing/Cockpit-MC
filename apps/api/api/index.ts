import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/create-app';

let serverPromise: Promise<
  (request: IncomingMessage, response: ServerResponse) => void
> | null = null;

async function getServer() {
  if (!serverPromise) {
    serverPromise = (async () => {
      const app = await createApp();
      await app.init();
      return app.getHttpAdapter().getInstance();
    })();
  }

  return serverPromise;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const server = await getServer();
  return server(request, response);
}
