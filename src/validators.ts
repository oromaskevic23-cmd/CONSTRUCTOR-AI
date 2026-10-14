import { z } from 'zod';

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().default("")
});

export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  completed: z.boolean().optional()
});

export const IdParamSchema = z.object({
  id: z.string().regex(/^[0-9]+$/)
});
