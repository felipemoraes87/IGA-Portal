"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";

type PublicSettings = {
  id: string;
  tenantKey: string;
  environment: "production" | "staging" | "sandbox";
  scim_base_url: string;
  connection_status: string;
  auth_type: "bearer_token" | "oauth2" | "api_key";
  bearer_token_masked?: string | null;
  oauth2: { token_url: string; client_id: string; client_secret_masked?: string | null; scopes: string[] };
  api_key: { api_key_masked?: string | null; api_key_header: string };
  token_expiration?: number | null;
  auto_rotate_token: boolean;
  enable_create_user: boolean;
  enable_update_user: boolean;
  update_method: "PATCH" | "PUT";
  enable_deactivate_user: boolean;
  enable_delete_user: boolean;
  provisioning_mode: "real_time" | "batch";
  attribute_mappings: Array<{
    scim_attribute: string;
    target_attribute: string;
    required: boolean;
    transformation: "none" | "lowercase" | "uppercase" | "concat" | "regex";
    default_value?: string | null;
  }>;
  enable_group_sync: boolean;
  group_source_of_truth: "scim" | "local" | "hybrid";
  group_mappings: Array<{ scim_group: string; business_role?: string | null; system_roles: string[] }>;
  sync_group_membership: boolean;
  sync_strategy: "full" | "incremental";
  sync_interval_minutes: number;
  retry_enabled: boolean;
  max_retries: number;
  retry_backoff: "fixed" | "exponential";
  ip_allowlist: string[];
  rate_limit_per_minute?: number | null;
  mtls_enabled: boolean;
  audit_enabled: boolean;
  retention_days: number;
  last_test: { at?: string | null; status?: string | null; message?: string | null };
  last_schema_validation: { at?: string | null; status?: string | null; message?: string | null };
  warnings: Record<string, string | null>;
};

type AuditItem = {
  id: string;
  action: string;
  entityId: string;
  actor: { id: string; email: string; name: string } | null;
  createdAt: string;
  details: unknown;
};

const tabs = ["Conexao", "Autenticacao", "Provisionamento", "Attribute Mapping", "Groups & Roles", "Sync & Seguranca", "Auditoria"] as const;

type TabName = (typeof tabs)[number];

export function ScimSettingsClient({ // NOSONAR
  initialSettings,
  attributeSuggestions,
}: Readonly<{ initialSettings: PublicSettings; attributeSuggestions: string[] }>) {
  const [activeTab, setActiveTab] = useState<TabName>("Conexao");
  const [form, setForm] = useState<PublicSettings>(initialSettings);
  const [draftSecrets, setDraftSecrets] = useState({
    bearer_token: "",
    oauth_client_secret: "",
    api_key: "",
  });
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<AuditItem[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);

  const initialSnapshot = useMemo(() => JSON.stringify(initialSettings), [initialSettings]);
  const currentSnapshot = useMemo(() => JSON.stringify(form), [form]);
  const hasUnsavedChanges = initialSnapshot !== currentSnapshot || Object.values(draftSecrets).some((value) => value.length > 0);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const loadAudit = useCallback(async (page: number) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      tenant: form.tenantKey,
      environment: form.environment,
    });
    const response = await fetch(`/api/admin/scim/audit?${params.toString()}`, { cache: "no-store" });
    const data = await response.json();
    setAuditRows(data.data || []);
    setAuditTotalPages(data.pagination?.totalPages || 1);
  }, [form.environment, form.tenantKey]);

  function update<K extends keyof PublicSettings>(key: K, value: PublicSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!form.scim_base_url) {
      setStatusMsg("SCIM base URL e obrigatoria.");
      return;
    }

    const criticalChanged =
      form.scim_base_url !== initialSettings.scim_base_url || form.auth_type !== initialSettings.auth_type || form.environment !== initialSettings.environment;
    if (criticalChanged) {
      const confirmed = window.confirm("Endpoint/Auth mudou. Deseja salvar mesmo assim?");
      if (!confirmed) return;
    }

    setSaving(true);
    setStatusMsg(null);
    const payload = {
      ...form,
      bearer_token: draftSecrets.bearer_token || undefined,
      oauth2: {
        ...form.oauth2,
        client_secret: draftSecrets.oauth_client_secret || undefined,
      },
      api_key: {
        ...form.api_key,
        api_key: draftSecrets.api_key || undefined,
      },
    };

    const response = await fetch("/api/admin/scim/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setStatusMsg(data.error || "Falha ao salvar.");
      return;
    }
    setForm(data.data);
    setDraftSecrets({ bearer_token: "", oauth_client_secret: "", api_key: "" });
    setStatusMsg("Configuracao salva.");
  }

  async function runTest(mode: "connection" | "schema") {
    setStatusMsg(null);
    const response = await fetch("/api/admin/scim/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settingsId: form.id, mode }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setStatusMsg(`${mode === "connection" ? "Test connection" : "Validate schema"}: ${data.error || "erro"}`);
      return;
    }
    setStatusMsg(`${mode === "connection" ? "Test connection" : "Validate schema"} executado com sucesso.`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <Card className="h-fit p-2">
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                if (tab === "Auditoria") {
                  setAuditPage(1);
                  void loadAudit(1);
                }
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                activeTab === tab ? "bg-rose-600 text-white" : "text-slate-700 hover:bg-rose-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </Card>

      <div className="space-y-4">
        {statusMsg ? <Card className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{statusMsg}</Card> : null}

        {activeTab === "Conexao" ? (
          <Card>
            <h3 className="text-sm font-bold">Conexao</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                SCIM Base URL
                <input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.scim_base_url} onChange={(e) => update("scim_base_url", e.target.value)} />
              </label>
              <label className="text-sm">
                Environment
                <select className="mt-1 w-full rounded-lg border px-3 py-2" value={form.environment} onChange={(e) => update("environment", e.target.value as PublicSettings["environment"])}>
                  <option value="production">production</option>
                  <option value="staging">staging</option>
                  <option value="sandbox">sandbox</option>
                </select>
              </label>
              <label className="text-sm">
                Tenant
                <input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.tenantKey} onChange={(e) => update("tenantKey", e.target.value)} />
              </label>
              <div className="text-sm">
                Connection status
                <div className="mt-1 rounded-lg border bg-slate-50 px-3 py-2">{form.connection_status}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="rounded-lg bg-[#800020] px-3 py-2 text-sm text-white" onClick={() => void runTest("connection")} type="button">
                Test connection
              </button>
              <button className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white" onClick={() => void runTest("schema")} type="button">
                Validate schema
              </button>
            </div>
          </Card>
        ) : null}

        {activeTab === "Autenticacao" ? (
          <Card>
            <h3 className="text-sm font-bold">Autenticacao</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Auth type
                <select className="mt-1 w-full rounded-lg border px-3 py-2" value={form.auth_type} onChange={(e) => update("auth_type", e.target.value as PublicSettings["auth_type"])}>
                  <option value="bearer_token">bearer_token</option>
                  <option value="oauth2">oauth2</option>
                  <option value="api_key">api_key</option>
                </select>
              </label>
              <label className="text-sm">
                Token expiration (optional)
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={form.token_expiration ?? ""}
                  onChange={(e) => update("token_expiration", e.target.value ? Number(e.target.value) : null)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.auto_rotate_token} onChange={(e) => update("auto_rotate_token", e.target.checked)} />
                auto_rotate_token (not implemented)
              </label>
            </div>

            {form.auth_type === "bearer_token" ? (
              <div className="mt-3 grid gap-2">
                <label className="text-sm">
                  Bearer token (secret)
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    placeholder={form.bearer_token_masked || "â€¢â€¢â€¢â€¢â€¢â€¢"}
                    value={draftSecrets.bearer_token}
                    onChange={(e) => setDraftSecrets((prev) => ({ ...prev, bearer_token: e.target.value }))}
                  />
                </label>
              </div>
            ) : null}

            {form.auth_type === "oauth2" ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="text-sm">
                  token_url
                  <input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.oauth2.token_url} onChange={(e) => update("oauth2", { ...form.oauth2, token_url: e.target.value })} />
                </label>
                <label className="text-sm">
                  client_id
                  <input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.oauth2.client_id} onChange={(e) => update("oauth2", { ...form.oauth2, client_id: e.target.value })} />
                </label>
                <label className="text-sm">
                  client_secret (secret)
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    placeholder={form.oauth2.client_secret_masked || "â€¢â€¢â€¢â€¢â€¢â€¢"}
                    value={draftSecrets.oauth_client_secret}
                    onChange={(e) => setDraftSecrets((prev) => ({ ...prev, oauth_client_secret: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  scopes (comma separated)
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    value={form.oauth2.scopes.join(",")}
                    onChange={(e) => update("oauth2", { ...form.oauth2, scopes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  />
                </label>
              </div>
            ) : null}

            {form.auth_type === "api_key" ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="text-sm">
                  api_key (secret)
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    placeholder={form.api_key.api_key_masked || "â€¢â€¢â€¢â€¢â€¢â€¢"}
                    value={draftSecrets.api_key}
                    onChange={(e) => setDraftSecrets((prev) => ({ ...prev, api_key: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  api_key_header
                  <input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.api_key.api_key_header} onChange={(e) => update("api_key", { ...form.api_key, api_key_header: e.target.value })} />
                </label>
              </div>
            ) : null}
          </Card>
        ) : null}

        {activeTab === "Provisionamento" ? (
          <Card>
            <h3 className="text-sm font-bold">Provisionamento</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enable_create_user} onChange={(e) => update("enable_create_user", e.target.checked)} /> enable_create_user</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enable_update_user} onChange={(e) => update("enable_update_user", e.target.checked)} /> enable_update_user</label>
              <label className="text-sm">update_method
                <select className="mt-1 w-full rounded-lg border px-3 py-2" value={form.update_method} onChange={(e) => update("update_method", e.target.value as "PATCH" | "PUT")}>
                  <option value="PATCH">PATCH</option>
                  <option value="PUT">PUT</option>
                </select>
              </label>
              <label className="text-sm">provisioning_mode
                <select className="mt-1 w-full rounded-lg border px-3 py-2" value={form.provisioning_mode} onChange={(e) => update("provisioning_mode", e.target.value as "real_time" | "batch")}>
                  <option value="real_time">real_time</option>
                  <option value="batch">batch</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enable_deactivate_user} onChange={(e) => update("enable_deactivate_user", e.target.checked)} /> enable_deactivate_user</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enable_delete_user} onChange={(e) => update("enable_delete_user", e.target.checked)} /> enable_delete_user (risky)</label>
            </div>
          </Card>
        ) : null}

        {activeTab === "Attribute Mapping" ? (
          <Card>
            <h3 className="text-sm font-bold">Attribute Mapping (Users)</h3>
            <div className="mt-2 text-xs text-slate-500">Sugestoes: {attributeSuggestions.join(", ")}</div>
            <div className="mt-3 space-y-2">
              {form.attribute_mappings.map((row, idx) => (
                <div key={`${row.scim_attribute}-${idx}`} className="grid gap-2 rounded-lg border p-2 md:grid-cols-5">
                  <input className="rounded border px-2 py-1 text-sm" value={row.scim_attribute} onChange={(e) => {
                    const next = [...form.attribute_mappings];
                    next[idx] = { ...next[idx], scim_attribute: e.target.value };
                    update("attribute_mappings", next);
                  }} />
                  <input className="rounded border px-2 py-1 text-sm" value={row.target_attribute} onChange={(e) => {
                    const next = [...form.attribute_mappings];
                    next[idx] = { ...next[idx], target_attribute: e.target.value };
                    update("attribute_mappings", next);
                  }} />
                  <select className="rounded border px-2 py-1 text-sm" value={row.transformation} onChange={(e) => {
                    const next = [...form.attribute_mappings];
                    next[idx] = { ...next[idx], transformation: e.target.value as typeof row.transformation };
                    update("attribute_mappings", next);
                  }}>
                    <option value="none">none</option>
                    <option value="lowercase">lowercase</option>
                    <option value="uppercase">uppercase</option>
                    <option value="concat">concat</option>
                    <option value="regex">regex</option>
                  </select>
                  <input className="rounded border px-2 py-1 text-sm" placeholder="default_value" value={row.default_value || ""} onChange={(e) => {
                    const next = [...form.attribute_mappings];
                    next[idx] = { ...next[idx], default_value: e.target.value };
                    update("attribute_mappings", next);
                  }} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={row.required} onChange={(e) => {
                    const next = [...form.attribute_mappings];
                    next[idx] = { ...next[idx], required: e.target.checked };
                    update("attribute_mappings", next);
                  }} /> required</label>
                </div>
              ))}
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => update("attribute_mappings", [...form.attribute_mappings, { scim_attribute: "", target_attribute: "", required: false, transformation: "none", default_value: "" }])}
              >
                Add mapping
              </button>
            </div>
          </Card>
        ) : null}

        {activeTab === "Groups & Roles" ? (
          <Card>
            <h3 className="text-sm font-bold">Groups & Roles</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enable_group_sync} onChange={(e) => update("enable_group_sync", e.target.checked)} /> enable_group_sync</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.sync_group_membership} onChange={(e) => update("sync_group_membership", e.target.checked)} /> sync_group_membership</label>
              <label className="text-sm">
                group_source_of_truth
                <select className="mt-1 w-full rounded-lg border px-3 py-2" value={form.group_source_of_truth} onChange={(e) => update("group_source_of_truth", e.target.value as PublicSettings["group_source_of_truth"])}>
                  <option value="scim">scim</option>
                  <option value="local">local</option>
                  <option value="hybrid">hybrid</option>
                </select>
              </label>
            </div>
            <div className="mt-3 space-y-2">
              {form.group_mappings.map((row, idx) => (
                <div key={`${row.scim_group}-${idx}`} className="grid gap-2 rounded-lg border p-2 md:grid-cols-3">
                  <input className="rounded border px-2 py-1 text-sm" placeholder="scim_group" value={row.scim_group} onChange={(e) => {
                    const next = [...form.group_mappings];
                    next[idx] = { ...next[idx], scim_group: e.target.value };
                    update("group_mappings", next);
                  }} />
                  <input className="rounded border px-2 py-1 text-sm" placeholder="business_role" value={row.business_role || ""} onChange={(e) => {
                    const next = [...form.group_mappings];
                    next[idx] = { ...next[idx], business_role: e.target.value };
                    update("group_mappings", next);
                  }} />
                  <input className="rounded border px-2 py-1 text-sm" placeholder="system_roles (comma separated)" value={row.system_roles.join(",")} onChange={(e) => {
                    const next = [...form.group_mappings];
                    next[idx] = { ...next[idx], system_roles: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) };
                    update("group_mappings", next);
                  }} />
                </div>
              ))}
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => update("group_mappings", [...form.group_mappings, { scim_group: "", business_role: "", system_roles: [] }])}
              >
                Add group mapping
              </button>
            </div>
          </Card>
        ) : null}

        {activeTab === "Sync & Seguranca" ? (
          <Card>
            <h3 className="text-sm font-bold">Sync / Retry / Seguranca</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className="text-sm">sync_strategy
                <select className="mt-1 w-full rounded-lg border px-3 py-2" value={form.sync_strategy} onChange={(e) => update("sync_strategy", e.target.value as PublicSettings["sync_strategy"])}>
                  <option value="full">full</option>
                  <option value="incremental">incremental</option>
                </select>
              </label>
              <label className="text-sm">sync_interval_minutes
                <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.sync_interval_minutes} onChange={(e) => update("sync_interval_minutes", Number(e.target.value) || 0)} />
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.retry_enabled} onChange={(e) => update("retry_enabled", e.target.checked)} /> retry_enabled</label>
              <label className="text-sm">max_retries
                <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.max_retries} onChange={(e) => update("max_retries", Number(e.target.value) || 0)} />
              </label>
              <label className="text-sm">retry_backoff
                <select className="mt-1 w-full rounded-lg border px-3 py-2" value={form.retry_backoff} onChange={(e) => update("retry_backoff", e.target.value as PublicSettings["retry_backoff"])}>
                  <option value="fixed">fixed</option>
                  <option value="exponential">exponential</option>
                </select>
              </label>
              <label className="text-sm">rate_limit_per_minute
                <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.rate_limit_per_minute ?? ""} onChange={(e) => update("rate_limit_per_minute", e.target.value ? Number(e.target.value) : null)} />
              </label>
              <label className="text-sm">ip_allowlist (comma separated)
                <input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.ip_allowlist.join(",")} onChange={(e) => update("ip_allowlist", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.mtls_enabled} onChange={(e) => update("mtls_enabled", e.target.checked)} /> mtls_enabled (requires infra support)</label>
            </div>
          </Card>
        ) : null}

        {activeTab === "Auditoria" ? (
          <Card>
            <h3 className="text-sm font-bold">Auditoria</h3>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.audit_enabled} onChange={(e) => update("audit_enabled", e.target.checked)} /> audit_enabled</label>
              <label className="text-sm">retention_days
                <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.retention_days} onChange={(e) => update("retention_days", Number(e.target.value) || 1)} />
              </label>
            </div>
            <div className="mt-4 space-y-2">
              {auditRows.map((row) => (
                <div key={row.id} className="rounded-lg border p-2 text-sm">
                  <div className="font-semibold">{row.action}</div>
                  <div className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString("pt-BR")} - {row.actor?.email || "system"}</div>
                </div>
              ))}
              {!auditRows.length ? <p className="text-sm text-slate-500">Sem eventos de auditoria.</p> : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-sm"
                  disabled={auditPage <= 1}
                  onClick={() => {
                    const next = Math.max(1, auditPage - 1);
                    setAuditPage(next);
                    void loadAudit(next);
                  }}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-sm"
                  disabled={auditPage >= auditTotalPages}
                  onClick={() => {
                    const next = Math.min(auditTotalPages, auditPage + 1);
                    setAuditPage(next);
                    void loadAudit(next);
                  }}
                >
                  Next
                </button>
                <span className="text-xs text-slate-500">Page {auditPage}/{auditTotalPages}</span>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="sticky bottom-4 flex justify-end">
          <button type="button" disabled={saving} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={() => void save()}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

