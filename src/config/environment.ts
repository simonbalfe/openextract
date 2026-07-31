import { z } from "zod";

const environmentInteger = (fallback: number, minimum: number) =>
  z.preprocess(
    (value) => (value === undefined || value === "" ? fallback : value),
    z.coerce.number().int().min(minimum),
  );

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalURL = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);

const environmentSchema = z
  .object({
    PORT: environmentInteger(8081, 1).pipe(z.number().max(65535)),
    OPENEXTRACT_MAX_CONCURRENCY: environmentInteger(20, 1),
    OPENEXTRACT_BROWSER_CONCURRENCY: environmentInteger(4, 1),
    OPENEXTRACT_MAX_WAITING: environmentInteger(100, 0),
    BROWSERLESS_URL: optionalURL,
    BROWSERLESS_TOKEN: optionalString,
    BROWSERLESS_TIMEOUT_MS: environmentInteger(60_000, 1_000),
  })
  .superRefine((value, context) => {
    if (value.OPENEXTRACT_BROWSER_CONCURRENCY > value.OPENEXTRACT_MAX_CONCURRENCY) {
      context.addIssue({
        code: "custom",
        message: "cannot exceed OPENEXTRACT_MAX_CONCURRENCY",
        path: ["OPENEXTRACT_BROWSER_CONCURRENCY"],
      });
    }
  });

export type OpenExtractEnvironment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: Record<string, string | undefined>): OpenExtractEnvironment {
  return environmentSchema.parse(input);
}
