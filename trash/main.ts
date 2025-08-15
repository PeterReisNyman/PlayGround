import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe());

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get(/^\/(?!api|survey|realtor).*/, (req, res) => {
    res.sendFile(
      join(__dirname, '..', '..', 'frontend', 'site', 'dist', 'index.html'),
    );
  });

  await app.listen(process.env.PORT ?? 3000);

  const shutdown = async () => {
    await app.close();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
void bootstrap();
