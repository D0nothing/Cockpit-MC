import 'reflect-metadata';
import { createApp } from './create-app';

async function bootstrap() {
  const app = await createApp();
  await app.listen(Number(process.env.API_PORT ?? 4000));
}
void bootstrap();
