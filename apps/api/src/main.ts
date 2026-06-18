import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/],
  });
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT || 3001);
  await app.listen(port, '127.0.0.1');
}

void bootstrap();
