import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';
import { Public } from '../../src/security/auth/public.decorator.js';
import { Roles } from '../../src/security/auth/roles.decorator.js';
import { RequireStepUp } from '../../src/security/auth/step-up.decorator.js';

export const STEP_UP_TEST_MAX_AGE_SECONDS = 300;

export class EchoRequestDto {
  @IsString()
  @Length(1, 50)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  amountGrosze!: number;
}

/** Routes that exist only in tests, to exercise the pipeline in situations the product does not have yet. */
@Controller('api/test')
export class TestApiController {
  @Roles('customer')
  @Post('echo')
  echo(@Body() body: EchoRequestDto): EchoRequestDto {
    return { name: body.name, amountGrosze: body.amountGrosze };
  }

  @Roles('admin')
  @RequireStepUp({ maxAgeSeconds: STEP_UP_TEST_MAX_AGE_SECONDS })
  @Get('step-up')
  stepUp(): { ok: true } {
    return { ok: true };
  }

  /** Neither @Public() nor @Roles(): must be refused. */
  @Get('undeclared')
  undeclared(): { ok: true } {
    return { ok: true };
  }

  /** @Public() outside the public zone: must be refused. */
  @Public()
  @Get('misplaced-public')
  misplacedPublic(): { ok: true } {
    return { ok: true };
  }

  @Roles('customer')
  @Get('explode')
  explode(): never {
    throw new Error('internal detail: connection string postgresql://sbank_app:hunter2@db/sbank');
  }
}

@Controller('public/test')
export class TestPublicController {
  @Public()
  @Get()
  ping(): { ok: true } {
    return { ok: true };
  }
}

@Controller('partner/test')
export class TestPartnerController {
  @Roles('partner')
  @Get()
  ping(): { ok: true } {
    return { ok: true };
  }
}

export const TEST_CONTROLLERS = [TestApiController, TestPublicController, TestPartnerController];
