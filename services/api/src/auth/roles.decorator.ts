import { SetMetadata } from '@nestjs/common';
import { Role } from '../employees/employee-fields';
import { ActorRole } from './actor.types';

export const ROLES_KEY = 'roles';

/**
 * Shared role-check decorator: requisitions/jobs routes use `ActorRole`
 * (dev actor stand-in), employee-profile routes use `Role` (Cognito claims).
 */
export const Roles = (...roles: (ActorRole | Role)[]) => SetMetadata(ROLES_KEY, roles);
