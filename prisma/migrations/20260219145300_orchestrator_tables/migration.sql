-- CreateTable
CREATE TABLE "assignment" (
    "_row_id" SERIAL NOT NULL,
    "id" TEXT,
    "action" TEXT,
    "created_at" TEXT,
    "source_process" TEXT,
    "user_id" TEXT,
    "user_name" TEXT,
    "requester_id" TEXT,
    "request_mode" TEXT,
    "justification" TEXT,
    "grant_type" TEXT,
    "grant_origin" TEXT,
    "business_role" TEXT,
    "system" TEXT,
    "system_id" TEXT,
    "system_role" TEXT,
    "status" TEXT,
    "grant_date" TEXT,
    "revocation_date" TEXT,
    "expiration_date" TEXT,
    "executor" TEXT,
    "approver" TEXT,
    "ticket" TEXT,
    "execution_id" TEXT,
    "log_details" TEXT,
    "business_role_name" TEXT,

    CONSTRAINT "assignment_pkey" PRIMARY KEY ("_row_id")
);

-- CreateTable
CREATE TABLE "business_roles" (
    "_row_id" SERIAL NOT NULL,
    "id" TEXT,
    "association_criteria" TEXT,
    "company" TEXT,
    "created_at" TEXT,
    "hash_string" TEXT,
    "is_current" TEXT,
    "last_revision_date" TEXT,
    "name" TEXT,
    "next_revision_date" TEXT,
    "owner" TEXT,
    "owner_id" TEXT,
    "status" TEXT,
    "technical_id" TEXT,
    "updated_at" TEXT,

    CONSTRAINT "business_roles_pkey" PRIMARY KEY ("_row_id")
);

-- CreateTable
CREATE TABLE "organizational" (
    "_row_id" SERIAL NOT NULL,
    "id" TEXT,
    "created_at" TEXT,
    "hash_string" TEXT,
    "is_current" TEXT,
    "name" TEXT,
    "owner" TEXT,
    "owner_id" TEXT,
    "parent" TEXT,
    "parent_id" TEXT,
    "status" TEXT,
    "type" TEXT,
    "updated_at" TEXT,
    "vp" TEXT,
    "vp_id" TEXT,

    CONSTRAINT "organizational_pkey" PRIMARY KEY ("_row_id")
);

-- CreateTable
CREATE TABLE "organizational_business_roles" (
    "_row_id" SERIAL NOT NULL,
    "id" TEXT,
    "business_role_id" TEXT,
    "created_at" TEXT,
    "is_current" TEXT,
    "organizational_id" TEXT,
    "updated_at" TEXT,

    CONSTRAINT "organizational_business_roles_pkey" PRIMARY KEY ("_row_id")
);

-- CreateTable
CREATE TABLE "snapshot_br_users_match" (
    "_row_id" SERIAL NOT NULL,
    "br_id" TEXT,
    "br_name" TEXT,
    "br_pede_area" TEXT,
    "br_pede_cargo" TEXT,
    "br_pede_cc" TEXT,
    "br_pede_contrato" TEXT,
    "br_pede_empresa" TEXT,
    "br_pede_senioridade" TEXT,
    "br_pede_vp" TEXT,
    "data_snapshot" TEXT,
    "email" TEXT,
    "user_hierarquia_completa" TEXT,
    "user_id" TEXT,
    "user_name" TEXT,
    "user_tem_area" TEXT,
    "user_tem_cargo" TEXT,
    "user_tem_cc" TEXT,
    "user_tem_contrato" TEXT,
    "user_tem_empresa" TEXT,
    "user_tem_senioridade" TEXT,
    "user_tem_vp" TEXT,

    CONSTRAINT "snapshot_br_users_match_pkey" PRIMARY KEY ("_row_id")
);

-- CreateTable
CREATE TABLE "snapshot_user_entitlements_detailed" (
    "_row_id" SERIAL NOT NULL,
    "data_snapshot" TEXT,
    "email" TEXT,
    "item_id" TEXT,
    "item_name" TEXT,
    "item_origin" TEXT,
    "item_technical_id" TEXT,
    "pacote_id" TEXT,
    "pacote_name" TEXT,
    "user_area" TEXT,
    "user_cargo" TEXT,
    "user_id" TEXT,
    "user_name" TEXT,

    CONSTRAINT "snapshot_user_entitlements_detailed_pkey" PRIMARY KEY ("_row_id")
);

-- CreateTable
CREATE TABLE "softwares" (
    "_row_id" SERIAL NOT NULL,
    "id" TEXT,
    "approvers_group" TEXT,
    "created_at" TEXT,
    "critical_system" TEXT,
    "hash_string" TEXT,
    "is_current" TEXT,
    "name" TEXT,
    "org_owner_id" TEXT,
    "pricing" TEXT,
    "provider" TEXT,
    "safety_assessment" TEXT,
    "status" TEXT,
    "technical_manager_id" TEXT,
    "updated_at" TEXT,

    CONSTRAINT "softwares_pkey" PRIMARY KEY ("_row_id")
);

-- CreateTable
CREATE TABLE "system_business_roles" (
    "_row_id" SERIAL NOT NULL,
    "id" TEXT,
    "business_role_id" TEXT,
    "created_at" TEXT,
    "is_current" TEXT,
    "system_role_id" TEXT,
    "updated_at" TEXT,

    CONSTRAINT "system_business_roles_pkey" PRIMARY KEY ("_row_id")
);

-- CreateTable
CREATE TABLE "system_roles" (
    "_row_id" SERIAL NOT NULL,
    "id" TEXT,
    "created_at" TEXT,
    "hash_string" TEXT,
    "is_current" TEXT,
    "name" TEXT,
    "origin" TEXT,
    "risk" TEXT,
    "software_id" TEXT,
    "technical_id" TEXT,
    "technical_reference" TEXT,
    "updated_at" TEXT,

    CONSTRAINT "system_roles_pkey" PRIMARY KEY ("_row_id")
);

-- CreateTable
CREATE TABLE "users" (
    "_row_id" SERIAL NOT NULL,
    "id" TEXT,
    "admission_date" TEXT,
    "company" TEXT,
    "contract_type" TEXT,
    "cost_center" TEXT,
    "cost_center_id" TEXT,
    "created_at" TEXT,
    "email" TEXT,
    "functional" TEXT,
    "functional_id" TEXT,
    "hash_string" TEXT,
    "is_current" TEXT,
    "job_title" TEXT,
    "job_title_id" TEXT,
    "manager" TEXT,
    "manager_id" TEXT,
    "name" TEXT,
    "organizational" TEXT,
    "organizational_id" TEXT,
    "seniority" TEXT,
    "slack_id" TEXT,
    "status" TEXT,
    "termination_date" TEXT,
    "updated_at" TEXT,
    "vp" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("_row_id")
);

-- CreateIndex
CREATE INDEX "assignment_id_idx" ON "assignment"("id");

-- CreateIndex
CREATE INDEX "assignment_user_id_idx" ON "assignment"("user_id");

-- CreateIndex
CREATE INDEX "assignment_system_id_idx" ON "assignment"("system_id");

-- CreateIndex
CREATE INDEX "assignment_system_role_idx" ON "assignment"("system_role");

-- CreateIndex
CREATE INDEX "assignment_business_role_idx" ON "assignment"("business_role");

-- CreateIndex
CREATE INDEX "business_roles_id_idx" ON "business_roles"("id");

-- CreateIndex
CREATE INDEX "business_roles_technical_id_idx" ON "business_roles"("technical_id");

-- CreateIndex
CREATE INDEX "business_roles_owner_id_idx" ON "business_roles"("owner_id");

-- CreateIndex
CREATE INDEX "organizational_id_idx" ON "organizational"("id");

-- CreateIndex
CREATE INDEX "organizational_owner_id_idx" ON "organizational"("owner_id");

-- CreateIndex
CREATE INDEX "organizational_parent_id_idx" ON "organizational"("parent_id");

-- CreateIndex
CREATE INDEX "organizational_business_roles_id_idx" ON "organizational_business_roles"("id");

-- CreateIndex
CREATE INDEX "organizational_business_roles_business_role_id_idx" ON "organizational_business_roles"("business_role_id");

-- CreateIndex
CREATE INDEX "organizational_business_roles_organizational_id_idx" ON "organizational_business_roles"("organizational_id");

-- CreateIndex
CREATE INDEX "snapshot_br_users_match_br_id_idx" ON "snapshot_br_users_match"("br_id");

-- CreateIndex
CREATE INDEX "snapshot_br_users_match_user_id_idx" ON "snapshot_br_users_match"("user_id");

-- CreateIndex
CREATE INDEX "snapshot_user_entitlements_detailed_user_id_idx" ON "snapshot_user_entitlements_detailed"("user_id");

-- CreateIndex
CREATE INDEX "snapshot_user_entitlements_detailed_item_id_idx" ON "snapshot_user_entitlements_detailed"("item_id");

-- CreateIndex
CREATE INDEX "snapshot_user_entitlements_detailed_pacote_id_idx" ON "snapshot_user_entitlements_detailed"("pacote_id");

-- CreateIndex
CREATE INDEX "softwares_id_idx" ON "softwares"("id");

-- CreateIndex
CREATE INDEX "softwares_org_owner_id_idx" ON "softwares"("org_owner_id");

-- CreateIndex
CREATE INDEX "system_business_roles_id_idx" ON "system_business_roles"("id");

-- CreateIndex
CREATE INDEX "system_business_roles_business_role_id_idx" ON "system_business_roles"("business_role_id");

-- CreateIndex
CREATE INDEX "system_business_roles_system_role_id_idx" ON "system_business_roles"("system_role_id");

-- CreateIndex
CREATE INDEX "system_roles_id_idx" ON "system_roles"("id");

-- CreateIndex
CREATE INDEX "system_roles_software_id_idx" ON "system_roles"("software_id");

-- CreateIndex
CREATE INDEX "system_roles_technical_id_idx" ON "system_roles"("technical_id");

-- CreateIndex
CREATE INDEX "users_id_idx" ON "users"("id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_manager_id_idx" ON "users"("manager_id");

-- CreateIndex
CREATE INDEX "users_organizational_id_idx" ON "users"("organizational_id");
