import { z } from 'zod';

export const PuzzleSchema = z.object({
  id: z.string().min(1), category: z.enum(['general','games','music','science','sport','food','geography','movies']),
  difficulty: z.enum(['easy','medium','hard']), answer: z.string().min(1), aliases: z.array(z.string()),
  halfA: z.string(), halfB: z.string(),
  halfAAlsoFits: z.array(z.string()), halfBAlsoFits: z.array(z.string()),
});
export type Puzzle = z.infer<typeof PuzzleSchema>;
