import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service.js';
import { parseEnv } from './env.schema.js';
import { isRootEnvFileEnabled, ROOT_ENV_FILE_PATH } from './root-env-file.js';

/**
 * Loads the root dotenv file (not in production), expands `${VAR}` references like the Prisma
 * config does, and fails the startup on invalid configuration.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ROOT_ENV_FILE_PATH,
      ignoreEnvFile: !isRootEnvFileEnabled(process.env['NODE_ENV']),
      expandVariables: true,
      validate: parseEnv,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
