import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CUSTOMER_IDENTITY_PROVIDER, CognitoCustomerIdentityProvider } from './customer-identity.provider';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [AuthModule],
  controllers: [CustomersController],
  providers: [CustomersService, { provide: CUSTOMER_IDENTITY_PROVIDER, useClass: CognitoCustomerIdentityProvider }],
})
export class CustomersModule {}
