import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3337",
    credentials: true,
  });

  const port = process.env.PORT || 3340;
  await app.listen(port);
  app.get(Logger).log(`Auth API running on http://localhost:${port}/api`);
}

bootstrap();
