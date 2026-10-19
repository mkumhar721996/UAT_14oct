import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { TOKEN_VERIFIER } from '../../src/auth/token-verifier';
import { CUSTOMER_IDENTITY_PROVIDER } from '../../src/customers/customer-identity.provider';
import { FakeCustomerIdentityProvider } from './fake-customer-identity-provider';
import { FakeDataSource } from './fake-data-source';

export const TENANT = '11111111-1111-4111-8111-111111111111';

/** Tokens in tests are JSON claims encoded as "test:<json>"; no real Cognito or Postgres is used. */
export const tokenFor = (claims: Record<string, unknown>) => `test:${JSON.stringify({ 'custom:tenant_id': TENANT, ...claims })}`;

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DataSource)
    .useValue(new FakeDataSource())
    .overrideProvider(TOKEN_VERIFIER)
    .useValue({
      async verify(token: string) {
        if (!token.startsWith('test:')) throw new Error('bad token');
        return JSON.parse(token.slice(5));
      },
    })
    .overrideProvider(CUSTOMER_IDENTITY_PROVIDER)
    .useValue(new FakeCustomerIdentityProvider(tokenFor))
    .compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  await app.init();
  return app;
}
