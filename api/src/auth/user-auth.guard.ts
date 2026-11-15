
import {
  Injectable,
  InternalServerErrorException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockAuthGuard } from './mock-auth.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly mockAuthGuard: MockAuthGuard,
    private readonly jwtAuthGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const mode = this.config.get<string>('AUTH_MODE') ??
      (this.config.get<string>('NODE_ENV') === 'production' ? 'oidc' : 'mock');

    if (mode === 'mock') {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new InternalServerErrorException(
          'Mock authentication is disabled in production',
        );
      }

      return this.mockAuthGuard.canActivate(context);
    }

    if (mode === 'oidc') {
      return this.jwtAuthGuard.canActivate(context);
    }

    throw new InternalServerErrorException(`Unsupported AUTH_MODE: ${mode}`);
  }
}

