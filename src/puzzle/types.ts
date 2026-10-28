import { z } from 'zod';

export const PredicateSchema=z.object({attribute:z.string(),operator:z.enum(['eq','has','only']).optional(),value:z.union([z.string(),z.number(),z.boolean(),z.array(z.union([z.string(),z.number(),z.boolean()]))])});
export const PuzzleSchema = z.object({
  id: z.string().min(1), category: z.enum(['general','games','music','science','sport','food','geography','movies','custom']),
  difficulty: z.enum(['easy','medium','hard']), answer: z.string().min(1), aliases: z.array(z.string()),
  halfA: z.string(), halfB: z.string(),
  halfAAlsoFits: z.array(z.string()).min(2), halfBAlsoFits: z.array(z.string()).min(2),
  alsoFitsA:z.array(z.string()).optional(),alsoFitsB:z.array(z.string()).optional(),
  sourceTable:z.string().optional(),
  /** One extra hint line per half, unlocked by that community's !hint vote. Never names the answer. */
  hintA:z.string().optional(),hintB:z.string().optional(),
  predicates:z.object({halfA:z.array(PredicateSchema).min(1).max(2),halfB:z.array(PredicateSchema).min(1).max(2),setSizeA:z.number().int().positive(),setSizeB:z.number().int().positive()}).optional(),
});
export type Puzzle = z.infer<typeof PuzzleSchema>;
export type PuzzleCategory=Puzzle['category'];
export type PuzzleDifficulty=Puzzle['difficulty'];
