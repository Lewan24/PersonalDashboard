import { z } from "zod";
import { safeUrl } from "./api";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const url = z.string().max(2048).refine(safeUrl);
export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  columnId: z.string().uuid(),
  descriptionMarkdown: z.string().max(20000),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]),
  dueDate: date,
  startDate: date,
  dueTime: z.string().nullable(),
  relatedDashboardItemId: z.string().uuid().nullable(),
  tagIds: z.array(z.string().uuid()).max(20),
  checklist: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(200),
        isChecked: z.boolean(),
      }),
    )
    .max(100),
  links: z
    .array(z.object({ title: z.string().trim().min(1).max(120), url }))
    .max(20),
  expectedVersion: z.number().int().positive().optional(),
});
