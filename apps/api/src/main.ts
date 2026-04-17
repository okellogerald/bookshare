import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { PostgrestProxyMiddleware } from "./modules/postgrest-proxy/postgrest-proxy.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const postgrestProxy = app.get(PostgrestProxyMiddleware);

  app.setGlobalPrefix("api");
  app.use((req: Request, res: Response, next: NextFunction) =>
    postgrestProxy.use(req, res, next)
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3334",
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle("Bookshare API")
    .setDescription("Book inventory management API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 3333;
  await app.listen(port);
  console.log(`Bookshare API running on http://localhost:${port}/api`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
