import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CustomersService } from './customers.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { LogInDto } from './dto/log-in.dto';
import { SignUpDto } from './dto/sign-up.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post('signup')
  signUp(@Body() dto: SignUpDto) {
    return this.customers.signUp(dto);
  }

  @Post('login')
  @HttpCode(200)
  logIn(@Body() dto: LogInDto) {
    return this.customers.logIn(dto);
  }

  @Get('me/bookings')
  @UseGuards(CognitoAuthGuard, RolesGuard)
  @Roles('customer')
  myBookings(@CurrentUser() user: AuthUser) {
    return this.customers.listBookings(user.tenantId, user.sub);
  }

  @Post('me/bookings')
  @UseGuards(CognitoAuthGuard, RolesGuard)
  @Roles('customer')
  submitBooking(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.customers.createBooking(user.tenantId, user.sub, dto);
  }
}
