import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Tokens } from './tokens';
import { ScimService } from 'tscim';
import { createInitialData } from './initial-data';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Get the SCIM service and create initial data
  const scimService = app.get<ScimService>(Tokens.ScimService);
  await createInitialData(scimService);

  await app.listen(process.env.PORT ?? 4000);
  console.log(
    `NestJS SCIM demo API listening on http://localhost:${process.env.PORT ?? 4000}`,
  );
}
void bootstrap();
