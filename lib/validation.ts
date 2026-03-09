import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
});

export const requestSchema = z
  .object({
    requestType: z.enum(["SINGLE", "MIRROR"]),
    targetUserId: z.string().min(1),
    permissionId: z.string().min(1).optional(),
    permissionIds: z.array(z.string().min(1)).optional(),
    mirrorFromUserId: z.string().min(1).optional(),
    accessDurationMonths: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]).optional(),
    accessDurationByPermissionId: z.record(z.string().min(1), z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)])).optional(),
    justification: z.string().min(10).max(500),
  })
  .superRefine((data, ctx) => {
    const hasSinglePermission = Boolean(data.permissionId) || Boolean(data.permissionIds?.length);
    if (data.requestType === "SINGLE" && !hasSinglePermission) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["permissionIds"],
        message: "permissionId or permissionIds is required for SINGLE requests",
      });
    }
    if (data.requestType === "MIRROR" && !data.mirrorFromUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mirrorFromUserId"],
        message: "mirrorFromUserId is required for MIRROR requests",
      });
    }
  });

export const approvalSchema = z.object({
  comment: z.string().max(300).optional(),
});

export const adminSystemSchema = z.object({
  name: z.string().min(2).max(80),
  criticality: z.enum(["LOW", "MED", "HIGH"]),
});

export const adminBusinessRoleSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(300).optional(),
});

export const adminUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(["USER", "MANAGER", "ADMIN"]),
  managerId: z.string().optional().nullable(),
});

const approvalDelegationScopeSchema = z.enum(["ANY", "MANAGER", "SYSTEM_OWNER", "SR_OWNER"]);

export const adminApprovalDelegationCreateSchema = z
  .object({
    delegatorId: z.string().min(1),
    delegateId: z.string().min(1),
    scope: approvalDelegationScopeSchema.default("ANY"),
    systemId: z.string().min(1).optional().nullable(),
    permissionId: z.string().min(1).optional().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    reason: z.string().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.delegatorId === data.delegateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["delegateId"],
        message: "delegateId must be different from delegatorId",
      });
    }

    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);
    if (startsAt >= endsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "endsAt must be greater than startsAt",
      });
    }
  });

export const adminApprovalDelegationPatchSchema = z
  .object({
    active: z.boolean().optional(),
    endsAt: z.string().datetime().optional(),
    reason: z.string().max(500).optional().nullable(),
  })
  .refine((data) => data.active !== undefined || data.endsAt !== undefined || data.reason !== undefined, {
    message: "At least one field must be provided",
  });

export const selfApprovalDelegationCreateSchema = z
  .object({
    delegateId: z.string().min(1),
    scope: approvalDelegationScopeSchema.default("ANY"),
    systemId: z.string().min(1).optional().nullable(),
    permissionId: z.string().min(1).optional().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    reason: z.string().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);
    if (startsAt >= endsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "endsAt must be greater than startsAt",
      });
    }
  });

export const selfApprovalDelegationPatchSchema = z
  .object({
    active: z.boolean().optional(),
    endsAt: z.string().datetime().optional(),
    reason: z.string().max(500).optional().nullable(),
  })
  .refine((data) => data.active !== undefined || data.endsAt !== undefined || data.reason !== undefined, {
    message: "At least one field must be provided",
  });
