import { z } from "zod";
import type {
  OKFBundle,
  OKFDocument,
  OKFValidationResult,
  OKFValidationError,
  OKFValidationWarning,
} from "./types.js";

const frontmatterSchema = z
  .object({
    type: z.string().min(1, "type field must be a non-empty string"),
    title: z.string().optional(),
    description: z.string().optional(),
    resource: z.string().url("resource must be a valid URL").optional(),
    tags: z.array(z.string()).optional(),
    timestamp: z.string().datetime({ offset: true }).optional(),
  })
  .passthrough();

export function validateDocument(doc: OKFDocument): {
  errors: OKFValidationError[];
  warnings: OKFValidationWarning[];
} {
  const errors: OKFValidationError[] = [];
  const warnings: OKFValidationWarning[] = [];

  const result = frontmatterSchema.safeParse(doc.frontmatter);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push({
        path: doc.relativePath,
        message: issue.message,
        rule: "frontmatter-schema",
      });
    }
  }

  if (!doc.body.trim()) {
    warnings.push({
      path: doc.relativePath,
      message: "Document body is empty",
      rule: "empty-body",
    });
  }

  if (doc.frontmatter.timestamp) {
    const d = Date.parse(doc.frontmatter.timestamp);
    if (isNaN(d)) {
      errors.push({
        path: doc.relativePath,
        message: `timestamp "${doc.frontmatter.timestamp}" is not a valid ISO 8601 date`,
        rule: "timestamp-format",
      });
    }
  }

  return { errors, warnings };
}

export function validateBundle(bundle: OKFBundle): OKFValidationResult {
  const allErrors: OKFValidationError[] = [];
  const allWarnings: OKFValidationWarning[] = [];

  for (const doc of bundle.documents) {
    const { errors, warnings } = validateDocument(doc);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  }

  for (const doc of bundle.documents) {
    for (const link of doc.links) {
      if (link.resolvedPath && !bundle.index.has(link.resolvedPath)) {
        allWarnings.push({
          path: doc.relativePath,
          message: `Cross-link "${link.href}" does not resolve to a known concept in this bundle`,
          rule: "unresolved-cross-link",
        });
      }
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}
