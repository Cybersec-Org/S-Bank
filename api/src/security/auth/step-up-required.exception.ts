import { HttpException, HttpStatus } from '@nestjs/common';

/** The token is valid but its authentication is too weak or too old for this operation (RFC 9470). */
export class StepUpRequiredException extends HttpException {
  constructor(
    readonly requiredAcr: string,
    readonly maxAgeSeconds: number,
  ) {
    super('Step-up authentication required', HttpStatus.FORBIDDEN);
  }
}
