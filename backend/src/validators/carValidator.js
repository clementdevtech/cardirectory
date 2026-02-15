const { z } = require("zod");

/* =========================================================
   🚗 Car Draft Validation Schema
========================================================= */
const carDraftSchema = z.object({
  id: z.number().optional(),

  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),

  year: z
    .number()
    .int()
    .min(1900, "Invalid year")
    .max(new Date().getFullYear() + 1),

  mileage: z.number().int().min(0),
  price: z.number().min(0),

  condition: z.enum(["new", "excellent", "good", "fair", "poor"]),

  transmission: z.string().nullable().optional(),

  location: z.string().min(1),
  description: z.string().min(10),
  phone: z.string().min(7),

  gallery: z.array(z.string().url()).max(8),
  video_url: z.string().url().optional().nullable(),
});

/* =========================================================
    Submit Car Validation Schema
========================================================= */
const submitCarSchema = z.object({
  id: z.coerce.number(),
});

module.exports = { carDraftSchema, submitCarSchema };
