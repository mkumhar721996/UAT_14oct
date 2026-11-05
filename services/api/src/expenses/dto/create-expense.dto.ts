import { IsIn, IsNumber, IsOptional, IsString, Matches, Max, Min, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../expense-categories';

const DATE_MESSAGE = 'Enter a date.';

@ValidatorConstraint({ name: 'notAfterToday' })
class NotAfterToday implements ValidatorConstraintInterface {
  validate(value: unknown) {
    // ISO dates compare correctly as strings; "today" is the UTC date.
    return typeof value !== 'string' || value <= new Date().toISOString().slice(0, 10);
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Date can’t be after today.';
  }
}

export class CreateExpenseDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Enter an amount.' })
  @Min(0.01, { message: 'Amount must be more than 0.00.' })
  @Max(9999999999.99, { message: 'Enter a smaller amount.' })
  amount!: number;

  @IsString({ message: DATE_MESSAGE })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  @Validate(NotAfterToday)
  date!: string;

  @IsIn(EXPENSE_CATEGORIES, { message: 'Choose a category.' })
  category!: ExpenseCategory;

  @IsOptional()
  @IsString()
  merchant?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
