import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { BODY_SHAPES } from './body-shapes';
import { BodyDiagramComponent, strengthFromLoad, strengthFromMuscles } from './BodyDiagramComponent';
import { MUSCLES } from './muscles';
import { muscleLoad } from './workout-math';

const shapesFor = (muscle: string) => [...document.querySelectorAll(`[data-muscles~="${muscle}"]`)];

it('has a region for every one of the seventeen muscle groups', () => {
  const drawn = new Set(BODY_SHAPES.flatMap((shape) => shape.muscles));
  expect(MUSCLES.filter((muscle) => !drawn.has(muscle))).toEqual([]);
});

it('fills primary muscles fully, secondary ones faintly, and names both beside the figure', () => {
  render(<BodyDiagramComponent label="Muscles worked by bench press" strength={strengthFromMuscles({ primary: ['chest'], secondary: ['triceps'] })} />);
  expect(screen.getByRole('img', { name: 'Muscles worked by bench press' })).toBeInTheDocument();
  expect(shapesFor('chest').length).toBeGreaterThan(0);
  for (const shape of shapesFor('chest')) expect(shape).toHaveAttribute('data-strength', '1');
  for (const shape of shapesFor('triceps')) expect(shape).toHaveAttribute('data-strength', '0.4');
  for (const shape of shapesFor('quads')) expect(shape).toHaveAttribute('data-strength', '0');
  expect(within(screen.getByRole('group', { name: 'Primary' })).getByText('Chest')).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Secondary' })).getByText('Triceps')).toBeInTheDocument();
});

it('lights the shared upper-back region for lats or middle back, at the stronger of the two', () => {
  render(<BodyDiagramComponent label="Back" strength={{ lats: 0.4, middleBack: 1 }} />);
  for (const shape of shapesFor('lats')) expect(shape).toHaveAttribute('data-strength', '1');
});

it('says so when nothing is worked, and scales a week of training without dividing by zero', () => {
  render(<BodyDiagramComponent label="This week" strength={strengthFromLoad(muscleLoad([]))} />);
  expect(screen.getByText('No muscles worked yet.')).toBeInTheDocument();
  expect(Object.values(strengthFromLoad(muscleLoad([]))).every((value) => value === 0)).toBe(true);
  expect(strengthFromLoad({ ...muscleLoad([]), chest: 6, triceps: 3 })).toMatchObject({ chest: 1, triceps: 0.5, quads: 0 });
});
