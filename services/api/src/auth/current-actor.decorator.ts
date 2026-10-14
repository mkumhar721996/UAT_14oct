import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Actor, ActorRequest } from './actor.types';

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor | undefined =>
    ctx.switchToHttp().getRequest<ActorRequest>().actor,
);
