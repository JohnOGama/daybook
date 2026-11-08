import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, UserId } from '../../auth/index.ts';
import {
  createSubtaskSchema,
  createTaskSchema,
  finishedSchema,
  parseOrThrow,
  rangeSchema,
  todaySchema,
  updateTaskSchema,
} from './task-schemas.ts';
import { TasksService } from './tasks-service.ts';

@UseGuards(AuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService) {}

  @Get()
  list(@UserId() userId: string, @Query() query: unknown) {
    return this.tasks.list(userId, parseOrThrow(rangeSchema, query));
  }

  @Post()
  create(@UserId() userId: string, @Body() body: unknown) {
    return this.tasks.create(userId, parseOrThrow(createTaskSchema, body));
  }

  @Post(':id/subtasks')
  createSubtask(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.tasks.createSubtask(userId, id, parseOrThrow(createSubtaskSchema, body));
  }

  @Patch(':id')
  update(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.tasks.update(userId, id, parseOrThrow(updateTaskSchema, body));
  }

  @Put(':id/finished')
  setFinished(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const { finished, today } = parseOrThrow(finishedSchema, body);
    return this.tasks.setFinished(userId, id, finished, today);
  }

  @Delete(':id')
  remove(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: unknown,
  ) {
    return this.tasks.remove(userId, id, parseOrThrow(todaySchema, query).today);
  }
}
