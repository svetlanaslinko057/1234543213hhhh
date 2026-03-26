import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    credentials: true,
  });
  
  // Global prefix
  app.setGlobalPrefix('api');
  
  // Validation
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));
  
  const port = process.env.PORT || 8001;
  await app.listen(port);
  
  console.log(`
═══════════════════════════════════════════════════════════════
  FOMO Crypto Intelligence API (NestJS)
  Version: 2.0.0
  Port: ${port}
  Docs: http://localhost:${port}/api
═══════════════════════════════════════════════════════════════
  `);
}

bootstrap();
