import { ValidationPipe } from '@nestjs/common';

/** Rejects unknown properties instead of silently dropping them (SR-06, mass-assignment guard). */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
  });
}
