import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/** Version of the HTTP contract; bump it when the API changes in a way clients must notice. */
const API_VERSION = '0.1.0';

export const DOCS_PATH = 'public/docs';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('S-Bank API')
    .setDescription('Demonstration banking API. Errors are RFC 9457 problem details.')
    .setVersion(API_VERSION)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addServer('/')
    .build();
  return SwaggerModule.createDocument(app, config);
}

/** Swagger UI for development; never mounted in production. */
export function mountSwaggerUi(app: INestApplication): void {
  SwaggerModule.setup(DOCS_PATH, app, buildOpenApiDocument(app));
}
