import { IsIn, IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';
import { DEFECT_PRIORITIES, DefectPriority } from '../defect-priorities';

export const TRANSITION_ACTIONS = ['triage', 'assign', 'start', 'resolve', 'verify', 'reopen'] as const;
export type TransitionAction = (typeof TRANSITION_ACTIONS)[number];

export class TransitionDefectDto {
  @IsIn(TRANSITION_ACTIONS, { message: 'Choose a valid workflow action.' })
  action!: TransitionAction;

  @ValidateIf((o) => o.action === 'triage')
  @IsIn(DEFECT_PRIORITIES, { message: "Priority can't be empty." })
  priority?: DefectPriority;

  @ValidateIf((o) => o.action === 'assign')
  @IsString({ message: 'Choose an assignee.' })
  @IsNotEmpty({ message: 'Choose an assignee.' })
  @Matches(/\S/, { message: 'Choose an assignee.' })
  assigneeId?: string;

  @ValidateIf((o) => o.action === 'resolve')
  @IsString({ message: "Resolution note can't be empty." })
  @IsNotEmpty({ message: "Resolution note can't be empty." })
  @Matches(/\S/, { message: "Resolution note can't be empty." })
  resolutionNote?: string;

  @ValidateIf((o) => o.action === 'reopen')
  @IsString({ message: "Reopen reason can't be empty." })
  @IsNotEmpty({ message: "Reopen reason can't be empty." })
  @Matches(/\S/, { message: "Reopen reason can't be empty." })
  reopenReason?: string;
}
