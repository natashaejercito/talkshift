import { z } from 'zod'

export const timeOffRequestSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  note: z.string().max(200).optional(),
})