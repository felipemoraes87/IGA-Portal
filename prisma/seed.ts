import { PrismaClient, UserRole, AssignmentSource } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.accessApproval.deleteMany();
  await prisma.accessExecution.deleteMany();
  await prisma.accessRequest.deleteMany();
  await prisma.userPermissionAssignment.deleteMany();
  await prisma.userBusinessRole.deleteMany();
  await prisma.businessRolePermission.deleteMany();
  await prisma.businessRole.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.system.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: "admin@iga.local",
      name: "Alice Admin",
      role: UserRole.ADMIN,
      roleAssignments: {
        createMany: {
          data: [{ role: UserRole.USER }, { role: UserRole.ADMIN }],
        },
      },
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: "manager@iga.local",
      name: "Marcos Manager",
      role: UserRole.MANAGER,
      roleAssignments: {
        createMany: {
          data: [{ role: UserRole.USER }, { role: UserRole.MANAGER }],
        },
      },
    },
  });

  const user1 = await prisma.user.create({
    data: {
      email: "ana@iga.local",
      name: "Ana User",
      role: UserRole.USER,
      managerId: manager.id,
      roleAssignments: {
        create: { role: UserRole.USER },
      },
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: "joao@iga.local",
      name: "Joao User",
      role: UserRole.USER,
      managerId: manager.id,
      roleAssignments: {
        create: { role: UserRole.USER },
      },
    },
  });

  const gcp = await prisma.system.create({
    data: {
      name: "GCP",
      criticality: "HIGH",
    },
  });

  const slack = await prisma.system.create({
    data: {
      name: "Slack",
      criticality: "MED",
    },
  });

  const github = await prisma.system.create({
    data: {
      name: "GitHub",
      criticality: "HIGH",
    },
  });

  const jira = await prisma.system.create({
    data: {
      name: "Jira",
      criticality: "MED",
    },
  });

  const [gcpViewer, gcpEditor, slackAdmin, slackMember, githubReader, githubMaintainer, jiraAgent, jiraProjectAdmin] = await Promise.all([
    prisma.permission.create({
      data: {
        systemId: gcp.id,
        name: "project.viewer",
        description: "Read-only access to projects",
      },
    }),
    prisma.permission.create({
      data: {
        systemId: gcp.id,
        name: "project.editor",
        description: "Edit access to projects",
      },
    }),
    prisma.permission.create({
      data: {
        systemId: slack.id,
        name: "workspace.admin",
        description: "Slack workspace administration",
      },
    }),
    prisma.permission.create({
      data: {
        systemId: slack.id,
        name: "workspace.member",
        description: "Basic Slack usage",
      },
    }),
    prisma.permission.create({
      data: {
        systemId: github.id,
        name: "repo.reader",
        description: "Read repositories",
      },
    }),
    prisma.permission.create({
      data: {
        systemId: github.id,
        name: "repo.maintainer",
        description: "Maintain repositories and teams",
      },
    }),
    prisma.permission.create({
      data: {
        systemId: jira.id,
        name: "project.agent",
        description: "Handle tickets",
      },
    }),
    prisma.permission.create({
      data: {
        systemId: jira.id,
        name: "project.admin",
        description: "Project configuration and governance",
      },
    }),
  ]);

  const engineeringBR = await prisma.businessRole.create({
    data: {
      name: "BR_Engineering_Standard",
      description: "Core engineering access package",
    },
  });

  const supportBR = await prisma.businessRole.create({
    data: {
      name: "BR_Support_Operations",
      description: "Support team access package",
    },
  });

  await prisma.businessRolePermission.createMany({
    data: [
      { businessRoleId: engineeringBR.id, permissionId: gcpViewer.id },
      { businessRoleId: engineeringBR.id, permissionId: slackMember.id },
      { businessRoleId: engineeringBR.id, permissionId: githubReader.id },
      { businessRoleId: supportBR.id, permissionId: slackMember.id },
      { businessRoleId: supportBR.id, permissionId: gcpEditor.id },
      { businessRoleId: supportBR.id, permissionId: jiraAgent.id },
    ],
  });

  await prisma.userBusinessRole.createMany({
    data: [
      { userId: user1.id, businessRoleId: engineeringBR.id },
      { userId: user2.id, businessRoleId: supportBR.id },
      { userId: manager.id, businessRoleId: engineeringBR.id },
    ],
  });

  await prisma.userPermissionAssignment.createMany({
    data: [
      { userId: user1.id, permissionId: gcpViewer.id, source: AssignmentSource.BR },
      { userId: user1.id, permissionId: slackMember.id, source: AssignmentSource.BR },
      { userId: user1.id, permissionId: githubReader.id, source: AssignmentSource.BR },
      { userId: user1.id, permissionId: jiraProjectAdmin.id, source: AssignmentSource.DIRECT },
      { userId: user2.id, permissionId: slackMember.id, source: AssignmentSource.BR },
      { userId: user2.id, permissionId: gcpEditor.id, source: AssignmentSource.BR },
      { userId: user2.id, permissionId: jiraAgent.id, source: AssignmentSource.BR },
      { userId: user2.id, permissionId: githubMaintainer.id, source: AssignmentSource.DIRECT },
      { userId: manager.id, permissionId: gcpViewer.id, source: AssignmentSource.BR },
      { userId: manager.id, permissionId: githubReader.id, source: AssignmentSource.BR },
      { userId: admin.id, permissionId: slackAdmin.id, source: AssignmentSource.DIRECT },
      { userId: admin.id, permissionId: jiraProjectAdmin.id, source: AssignmentSource.DIRECT },
    ],
  });

  const pendingRequest = await prisma.accessRequest.create({
    data: {
      requesterId: user1.id,
      targetUserId: user1.id,
      permissionId: gcpEditor.id,
      justification: "Need to update IAM policy for squad project",
      status: "PENDING_APPROVAL",
      approverId: manager.id,
      idempotencyKey: "seed-pending-001",
    },
  });

  await prisma.accessRequest.create({
    data: {
      requesterId: user2.id,
      targetUserId: user2.id,
      permissionId: slackAdmin.id,
      justification: "Temporary admin for channel governance setup",
      status: "RUNNING",
      approverId: manager.id,
      idempotencyKey: "seed-running-001",
      approvals: {
        create: {
          approverId: manager.id,
          decision: "APPROVED",
          comment: "Approved for 15 days",
        },
      },
      execution: {
        create: {
          status: "RUNNING",
          idempotencyKey: "seed-running-001",
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: manager.id,
      action: "REQUEST_CREATED",
      entityType: "AccessRequest",
      entityId: pendingRequest.id,
      details: { reason: "seed_data" },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
