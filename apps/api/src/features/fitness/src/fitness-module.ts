import { Module } from '@nestjs/common';
import { BudgetModule } from '../../budget/index.ts';
import { SpacesModule } from '../../spaces/index.ts';
import { FitnessController } from './fitness-controller.ts';
import { FitnessFoodService } from './fitness-food-service.ts';
import { FitnessService } from './fitness-service.ts';
import { FitnessWorkoutService } from './fitness-workout-service.ts';

@Module({ imports: [SpacesModule, BudgetModule], controllers: [FitnessController], providers: [FitnessService, FitnessFoodService, FitnessWorkoutService] })
export class FitnessModule {}
