import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: false }));
  app.enableCors({ origin: (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',') });
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
