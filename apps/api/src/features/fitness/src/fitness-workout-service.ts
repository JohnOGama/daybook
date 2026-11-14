import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, between, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { fitnessExercises, fitnessWorkoutTemplates, fitnessWorkouts } from '../../../shared/db/schema.ts';
import type { ExerciseInput, TemplateInput, WorkoutInput } from './fitness-schemas.ts';
import { FitnessService } from './fitness-service.ts';

export type ExerciseDto = ExerciseInput & { id: string; custom: boolean };
export type WorkoutDto = WorkoutInput & { id: string };

type Owned = { id: string; spaceId: string };

const exerciseColumns = ({ name, kind, equipment, primary, secondary }: ExerciseInput) => ({
  name,
  kind,
  equipment,
  primaryMuscles: primary,
  secondaryMuscles: secondary,
});

@Injectable()
export class FitnessWorkoutService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(FitnessService) private readonly fitness: FitnessService,
  ) {}

  // Built-in exercises have no space; custom ones are seen only in their own.
  async listExercises(userId: string, spaceId: string): Promise<ExerciseDto[]> {
    await this.fitness.assertSpace(userId, spaceId);
    const rows = await this.db
      .select()
      .from(fitnessExercises)
      .where(or(isNull(fitnessExercises.spaceId), eq(fitnessExercises.spaceId, spaceId)))
      .orderBy(asc(fitnessExercises.name), asc(fitnessExercises.id));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind as ExerciseInput['kind'],
      equipment: row.equipment,
      primary: row.primaryMuscles as ExerciseInput['primary'],
      secondary: row.secondaryMuscles as ExerciseInput['secondary'],
      custom: row.spaceId !== null,
    }));
  }

  async createExercise(userId: string, { id, spaceId, ...exercise }: ExerciseInput & Owned): Promise<void> {
    await this.fitness.assertSpace(userId, spaceId);
    await this.db.insert(fitnessExercises).values({ id, spaceId, userId, ...exerciseColumns(exercise) });
  }

  async updateExercise(userId: string, id: string, exercise: ExerciseInput): Promise<void> {
    const saved = await this.db.update(fitnessExercises).set(exerciseColumns(exercise)).where(this.ownExercise(userId, id)).returning({ id: fitnessExercises.id });
    if (saved.length === 0) throw new NotFoundException('Exercise not found');
  }

  async removeExercise(userId: string, id: string): Promise<void> {
    const removed = await this.db.delete(fitnessExercises).where(this.ownExercise(userId, id)).returning({ id: fitnessExercises.id });
    if (removed.length === 0) throw new NotFoundException('Exercise not found');
  }

  async createTemplate(userId: string, template: TemplateInput & Owned): Promise<void> {
    await this.fitness.assertSpace(userId, template.spaceId);
    await this.db.insert(fitnessWorkoutTemplates).values({ ...template, userId });
  }

  async saveTemplate(userId: string, id: string, template: TemplateInput): Promise<void> {
    const saved = await this.db
      .update(fitnessWorkoutTemplates)
      .set(template)
      .where(and(eq(fitnessWorkoutTemplates.id, id), eq(fitnessWorkoutTemplates.userId, userId)))
      .returning({ id: fitnessWorkoutTemplates.id });
    if (saved.length === 0) throw new NotFoundException('Template not found');
  }

  async removeTemplate(userId: string, id: string): Promise<void> {
    const removed = await this.db
      .delete(fitnessWorkoutTemplates)
      .where(and(eq(fitnessWorkoutTemplates.id, id), eq(fitnessWorkoutTemplates.userId, userId)))
      .returning({ id: fitnessWorkoutTemplates.id });
    if (removed.length === 0) throw new NotFoundException('Template not found');
  }

  async workouts(userId: string, spaceId: string, from: string, to: string): Promise<WorkoutDto[]> {
    await this.fitness.assertSpace(userId, spaceId);
    const rows = await this.db
      .select({ id: fitnessWorkouts.id, day: fitnessWorkouts.day, name: fitnessWorkouts.name, items: fitnessWorkouts.items })
      .from(fitnessWorkouts)
      .where(and(eq(fitnessWorkouts.spaceId, spaceId), eq(fitnessWorkouts.userId, userId), between(fitnessWorkouts.day, from, to)))
      .orderBy(asc(fitnessWorkouts.day), asc(fitnessWorkouts.createdAt), asc(fitnessWorkouts.id));
    return rows as WorkoutDto[];
  }

  async createWorkout(userId: string, workout: WorkoutInput & Owned): Promise<void> {
    await this.fitness.assertSpace(userId, workout.spaceId);
    await this.db.insert(fitnessWorkouts).values({ ...workout, userId });
  }

  async saveWorkout(userId: string, id: string, workout: WorkoutInput): Promise<void> {
    const saved = await this.db
      .update(fitnessWorkouts)
      .set(workout)
      .where(and(eq(fitnessWorkouts.id, id), eq(fitnessWorkouts.userId, userId)))
      .returning({ id: fitnessWorkouts.id });
    if (saved.length === 0) throw new NotFoundException('Workout not found');
  }

  async removeWorkout(userId: string, id: string): Promise<void> {
    const removed = await this.db
      .delete(fitnessWorkouts)
      .where(and(eq(fitnessWorkouts.id, id), eq(fitnessWorkouts.userId, userId)))
      .returning({ id: fitnessWorkouts.id });
    if (removed.length === 0) throw new NotFoundException('Workout not found');
  }

  private ownExercise(userId: string, id: string) {
    return and(eq(fitnessExercises.id, id), eq(fitnessExercises.userId, userId), isNotNull(fitnessExercises.spaceId));
  }
}
