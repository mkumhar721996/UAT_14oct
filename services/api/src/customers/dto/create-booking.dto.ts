import { IsIn } from 'class-validator';
import { SERVICE_TYPES, ServiceType } from '../service-types';

export class CreateBookingDto {
  @IsIn(SERVICE_TYPES, { message: 'Choose a service type.' })
  serviceType!: ServiceType;
}
