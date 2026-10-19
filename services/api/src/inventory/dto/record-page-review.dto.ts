import { IsIn, IsISO8601, IsNotEmpty, IsString, Matches } from 'class-validator';

export class RecordPageReviewDto {
  @IsString({ message: 'Enter the reviewer name.' })
  @IsNotEmpty({ message: 'Enter the reviewer name.' })
  @Matches(/\S/, { message: 'Enter the reviewer name.' })
  reviewerName!: string;

  @IsISO8601({ strict: true }, { message: 'Enter the review date.' })
  reviewDate!: string;

  @IsIn(['pass', 'fail'], { message: 'Result must be pass or fail.' })
  result!: 'pass' | 'fail';
}
