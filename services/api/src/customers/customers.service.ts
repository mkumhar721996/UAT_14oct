import { BadRequestException, ConflictException, HttpException, HttpStatus, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CUSTOMER_IDENTITY_PROVIDER,
  CustomerIdentityProvider,
  EmailAlreadyRegisteredError,
  InvalidPasswordError,
  ProviderThrottledError,
} from './customer-identity.provider';
import { CreateBookingDto } from './dto/create-booking.dto';
import { LogInDto } from './dto/log-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { Booking } from './entities/booking.entity';
import { SERVICE_TYPES, ServiceType } from './service-types';

export const INVALID_CREDENTIALS_MESSAGE = "That email and password don't match. Check your details and try again.";

const normaliseEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(CUSTOMER_IDENTITY_PROVIDER) private readonly identity: CustomerIdentityProvider,
  ) {}

  async signUp(dto: SignUpDto): Promise<{ email: string }> {
    const email = normaliseEmail(dto.email);
    try {
      await this.identity.signUp(email, dto.password);
    } catch (err) {
      if (err instanceof EmailAlreadyRegisteredError) throw new ConflictException(`An account with ${email} already exists. Log in instead.`);
      throw this.translate('signUp', err);
    }
    return { email };
  }

  async logIn(dto: LogInDto): Promise<{ accessToken: string }> {
    let result: { accessToken: string } | null;
    try {
      result = await this.identity.login(normaliseEmail(dto.email), dto.password);
    } catch (err) {
      throw this.translate('logIn', err);
    }
    if (!result) throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    return result;
  }

  /** Maps identity-provider failures to client-meaningful HTTP errors; anything else is logged (never with credentials) and rethrown. */
  private translate(operation: string, err: unknown): unknown {
    if (err instanceof InvalidPasswordError) return new BadRequestException('Choose a stronger password that meets the password requirements.');
    if (err instanceof ProviderThrottledError) {
      // Structured so a log-based metric can count Cognito call outcomes by op/outcome.
      this.logger.warn(`cognito_call_outcome count=1 op=${operation} outcome=throttled error=${(err as Error).message}`);
      return new HttpException('Too many attempts. Wait a moment and try again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    this.logger.error(`Identity provider ${operation} failed: ${(err as Error)?.name}: ${(err as Error)?.message}`);
    return err;
  }

  listServiceTypes(): readonly ServiceType[] {
    return SERVICE_TYPES;
  }

  createBooking(tenantId: string, customerSub: string, dto: CreateBookingDto): Promise<Booking> {
    const repo = this.dataSource.getRepository(Booking);
    return repo.save(repo.create({ tenantId, customerSub, serviceType: dto.serviceType, status: 'Requested' }));
  }

  listBookings(tenantId: string, customerSub: string): Promise<Booking[]> {
    return this.dataSource.getRepository(Booking).find({ where: { tenantId, customerSub }, order: { createdAt: 'ASC' } });
  }
}
