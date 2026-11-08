import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator(
  (_: unknown, context: ExecutionContext): string => context.switchToHttp().getRequest().userId,
);
