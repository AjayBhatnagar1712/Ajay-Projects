/**
 * Vercel-bundled copy of @workspace/api-schemas broker profile Zod schemas.
 * Keep in sync with lib/api-schemas/src/brokerProfile.ts (mobile imports the workspace package).
 */
import { z } from "zod";

const currentYear = new Date().getFullYear();

export const BrokerEmploymentTypeSchema = z.enum(["full_time", "part_time"]);

export const BrokerDealsWithOptionSchema = z.enum([
  "rent",
  "sale",
  "maintenance",
  "other",
]);

export const BrokerPropertyTypeSchema = z.enum([
  "flats",
  "independent_house",
  "community_flats",
  "villas",
  "commercial",
  "other",
]);

function requireOtherTextWhenSelected(
  selected: string[],
  otherText: string | null | undefined,
  path: string,
  message: string,
  ctx: z.RefinementCtx,
): void {
  if (!selected.includes("other")) {
    return;
  }
  if (otherText == null || otherText.trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: [path],
    });
  }
}

export const BrokerProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  age: z.number().int().positive().nullable(),
  firmName: z.string().nullable(),
  employmentType: z.string(),
  businessSinceYear: z.number().int().nullable(),
  propertiesHandled: z.number().int().nullable(),
  dealsWith: z.array(z.string()),
  dealsWithOther: z.string().nullable(),
  propertyTypes: z.array(z.string()),
  propertyTypesOther: z.string().nullable(),
  region: z.string(),
  pincodes: z.array(z.string()),
  stepCompleted: z.number().int().min(0).max(4),
  onboardingCompletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BrokerProfile = z.infer<typeof BrokerProfileSchema>;

/** Out-of-range age (under 18 or over 120). */
export const BROKER_AGE_ERROR = "Please enter a correct age";
/** Empty / missing age on step 1. */
export const BROKER_AGE_REQUIRED_ERROR = "Age is required";

/**
 * Step 1 age: blank/NaN/wrong type → "Age is required"; out of 18–120 →
 * BROKER_AGE_ERROR. Prefer `z.number` over `z.coerce` so empty form state
 * (`undefined`) does not become NaN and leak Zod's default nan message.
 */
const brokerOnboardingAgeSchema = z
  .number({
    required_error: BROKER_AGE_REQUIRED_ERROR,
    invalid_type_error: BROKER_AGE_REQUIRED_ERROR,
  })
  .int(BROKER_AGE_ERROR)
  .min(18, BROKER_AGE_ERROR)
  .max(120, BROKER_AGE_ERROR);

/** Step 1 — identity (employment answered on step 2; DB keeps '' until then) */
export const BrokerOnboardingStep1Schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  age: brokerOnboardingAgeSchema,
  firmName: z.string().trim().optional().nullable(),
  stepCompleted: z.literal(1),
});

/** Step 2 — experience + employment type */
export const BROKER_YEAR_REQUIRED_ERROR = "Year is required";
export const BROKER_PROPERTIES_REQUIRED_ERROR = "Properties handled is required";

export const BrokerOnboardingStep2Schema = z.object({
  employmentType: BrokerEmploymentTypeSchema,
  // Avoid z.coerce: blank → 0 would pass min(0) for properties, and NaN leaks for year.
  businessSinceYear: z
    .number({
      required_error: BROKER_YEAR_REQUIRED_ERROR,
      invalid_type_error: BROKER_YEAR_REQUIRED_ERROR,
    })
    .int()
    .min(1950)
    .max(currentYear, `Year cannot be after ${currentYear}`),
  propertiesHandled: z
    .number({
      required_error: BROKER_PROPERTIES_REQUIRED_ERROR,
      invalid_type_error: BROKER_PROPERTIES_REQUIRED_ERROR,
    })
    .int()
    .min(0)
    .max(100_000),
  stepCompleted: z.literal(2),
});

export const BrokerOnboardingStep3Schema = z
  .object({
    dealsWith: z
      .array(BrokerDealsWithOptionSchema)
      .min(1, "Select at least one"),
    dealsWithOther: z.string().trim().optional().nullable(),
    propertyTypes: z
      .array(BrokerPropertyTypeSchema)
      .min(1, "Select at least one"),
    propertyTypesOther: z.string().trim().optional().nullable(),
    stepCompleted: z.literal(3),
  })
  .superRefine((data, ctx) => {
    requireOtherTextWhenSelected(
      data.dealsWith,
      data.dealsWithOther,
      "dealsWithOther",
      "Describe other deal type",
      ctx,
    );
    requireOtherTextWhenSelected(
      data.propertyTypes,
      data.propertyTypesOther,
      "propertyTypesOther",
      "Describe other property type",
      ctx,
    );
  });

export const BrokerOnboardingStep4Schema = z.object({
  region: z.string().trim().min(1, "Add at least one work location"),
  pincodes: z
    .array(z.string().trim().regex(/^\d{6}$/, "Each pincode must be 6 digits"))
    .min(1, "Add at least one 6-digit pincode"),
  stepCompleted: z.literal(4),
});

export const BrokerProfilePatchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    age: z.number().int().min(18).max(120).optional(),
    firmName: z.string().trim().nullable().optional(),
    employmentType: BrokerEmploymentTypeSchema.or(z.literal("")).optional(),
    businessSinceYear: z.number().int().min(1950).max(currentYear).optional(),
    propertiesHandled: z.number().int().min(0).max(100_000).optional(),
    dealsWith: z.array(BrokerDealsWithOptionSchema).optional(),
    dealsWithOther: z.string().trim().nullable().optional(),
    propertyTypes: z.array(BrokerPropertyTypeSchema).optional(),
    propertyTypesOther: z.string().trim().nullable().optional(),
    region: z.string().trim().optional(),
    pincodes: z.array(z.string().regex(/^\d{6}$/)).optional(),
    stepCompleted: z.number().int().min(0).max(4),
  })
  .superRefine((body, ctx) => {
    if (body.stepCompleted === 1) {
      const parsed = BrokerOnboardingStep1Schema.safeParse({ ...body, stepCompleted: 1 });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue(issue);
        }
      }
    }
    if (body.stepCompleted === 2) {
      const parsed = BrokerOnboardingStep2Schema.safeParse({ ...body, stepCompleted: 2 });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue(issue);
        }
      }
    }
    if (body.stepCompleted === 3) {
      const parsed = BrokerOnboardingStep3Schema.safeParse({ ...body, stepCompleted: 3 });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue(issue);
        }
      }
    }
    if (body.stepCompleted === 4) {
      const parsed = BrokerOnboardingStep4Schema.safeParse({ ...body, stepCompleted: 4 });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue(issue);
        }
      }
    }
  });

export type BrokerProfilePatch = z.infer<typeof BrokerProfilePatchSchema>;
