import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/logger/winston.config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { seedSystemSettings } from './database/seeds/system-settings.seed';

async function bootstrap() {
  // 1. Cast the app to NestExpressApplication to access Express-specific methods
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  // 2. Global pipes & interceptors
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true, // Optional: more strict validation
  }));

  const dataSource = app.get(DataSource);
  await seedSystemSettings(dataSource);

  // 3. Serve Static Assets (The Uploads Folder)
  // This makes: http://localhost:4002/uploads/your-image.jpg accessible
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // 4. Security & Connectivity
  app.enableCors();

  // 5. Start the server
  await app.listen(4002, '0.0.0.0');

  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();