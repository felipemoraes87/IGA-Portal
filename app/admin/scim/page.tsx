import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { ScimSettingsClient } from "@/components/scim-settings-client";
import { UserManagementSubnav } from "@/components/user-management-subnav";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { DEFAULT_SCIM_ATTRIBUTE_MAPPINGS, SCIM_ATTRIBUTE_SUGGESTIONS, toPublicSettings } from "@/lib/scim-settings";

async function ensureDefaultSettings() {
  return db.scimSettings.upsert({
    where: {
      tenantKey_environment: {
        tenantKey: "default",
        environment: "production",
      },
    },
    update: {},
    create: {
      tenantKey: "default",
      environment: "production",
      scimBaseUrl: "http://localhost:3000/api/scim/v2",
      authType: "bearer_token",
      apiKeyHeader: "Authorization",
      oauthScopes: [],
      attributeMappings: DEFAULT_SCIM_ATTRIBUTE_MAPPINGS,
      groupMappings: [],
      ipAllowlist: [],
    },
  });
}

export default async function AdminScimSettingsPage() {
  const user = await requirePageUser("ADMIN");
  const settings = await ensureDefaultSettings();

  return (
    <AppShell user={user} title="SCIM 2.0 Settings" description="Configuracao por tenant/environment, testes e auditoria.">
      <UserManagementSubnav active="scim" />
      <Card>
        <ScimSettingsClient initialSettings={toPublicSettings(settings)} attributeSuggestions={SCIM_ATTRIBUTE_SUGGESTIONS} />
      </Card>
    </AppShell>
  );
}
