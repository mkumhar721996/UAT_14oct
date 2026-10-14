import { Module } from '@nestjs/common';
import { CognitoAuthGuard } from './cognito-auth.guard';
import { RolesGuard } from './roles.guard';
import { CognitoTokenVerifier, TOKEN_VERIFIER } from './token-verifier';

@Module({
  providers: [{ provide: TOKEN_VERIFIER, useClass: CognitoTokenVerifier }, CognitoAuthGuard, RolesGuard],
  exports: [TOKEN_VERIFIER, CognitoAuthGuard, RolesGuard],
})
export class AuthModule {}
