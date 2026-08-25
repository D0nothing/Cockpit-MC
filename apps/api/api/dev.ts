import { createServer, type Server } from 'node:http';
import handler from './index';

export function startLocalServer(port = readPort(process.env.API_PORT)): Server {
  const server = createServer((request, response) => {
    void handler(request, response);
  });

  return server.listen(port, '127.0.0.1');
}

function readPort(value: string | undefined): number {
  const port = Number(value ?? 4000);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error('API_PORT must be an integer between 0 and 65535');
  }
  return port;
}

if (require.main === module) {
  const server = startLocalServer();
  server.on('listening', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : process.env.API_PORT ?? 4000;
    console.log(`Software Factory API listening on http://127.0.0.1:${port}`);
  });
}
