"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";

type PublicLogExportSettings = {
  id: string;
  tenantKey: string;
  destination: "SPLUNK_HEC" | "AWS_S3";
  enabled: boolean;
  splunk: {
    endpoint: string;
    tokenMasked: string | null;
    index: string;
    source: string;
    sourceType: string;
  };
  s3: {
    region: string;
    bucket: string;
    prefix: string;
    accessKeyIdMasked: string | null;
    secretAccessKeyMasked: string | null;
    sessionTokenMasked: string | null;
  };
  lastExport: {
    at: string | Date | null;
    status: string | null;
    message: string | null;
  };
};

type ExportResponse = {
  ok?: boolean;
  data?: {
    exportedRecords: number;
    destination: string;
    result?: unknown;
  };
  error?: string;
};

export function LogExportClient({ initialSettings }: Readonly<{ initialSettings: PublicLogExportSettings }>) {
  const [form, setForm] = useState({
    tenantKey: initialSettings.tenantKey,
    destination: initialSettings.destination,
    enabled: initialSettings.enabled,
    splunk: {
      endpoint: initialSettings.splunk.endpoint,
      token: "",
      index: initialSettings.splunk.index,
      source: initialSettings.splunk.source,
      sourceType: initialSettings.splunk.sourceType,
    },
    s3: {
      region: initialSettings.s3.region,
      bucket: initialSettings.s3.bucket,
      prefix: initialSettings.s3.prefix,
      accessKeyId: "",
      secretAccessKey: "",
      sessionToken: "",
    },
  });
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState(initialSettings.lastExport);
  const [exportWindow, setExportWindow] = useState(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - 1);
    return {
      from: from.toISOString().slice(0, 16),
      to: to.toISOString().slice(0, 16),
    };
  });

  const destinationLabel = useMemo(() => (form.destination === "SPLUNK_HEC" ? "Splunk HEC (SIEM)" : "AWS S3 (Bucket)"), [form.destination]);

  async function saveSettings() {
    setSaving(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/admin/logs/export/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatusMessage(payload.error || "Falha ao salvar configuracao.");
        return;
      }
      setStatusMessage("Configuracao de exportacao salva.");
    } catch {
      setStatusMessage("Erro de rede ao salvar configuracao.");
    } finally {
      setSaving(false);
    }
  }

  async function runExport() {
    setRunning(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/admin/logs/export/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: new Date(exportWindow.from).toISOString(),
          to: new Date(exportWindow.to).toISOString(),
        }),
      });
      const payload = (await response.json()) as ExportResponse;
      if (!response.ok || !payload.ok) {
        setStatusMessage(payload.error || "Falha ao exportar logs.");
        return;
      }
      setStatusMessage(`Exportacao concluida: ${payload.data?.exportedRecords || 0} registros para ${payload.data?.destination || "-"}.`);
      setLastExport({
        at: new Date().toISOString(),
        status: "success",
        message: `Exported ${payload.data?.exportedRecords || 0} logs`,
      });
    } catch {
      setStatusMessage("Erro de rede ao executar exportacao.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="border-slate-200">
      <h3 className="text-base font-semibold text-slate-900">Exportacao para SIEM/Bucket</h3>
      <p className="mt-1 text-sm text-slate-500">Configure o destino e exporte logs de auditoria para plataforma SIEM ou bucket.</p>

      {statusMessage ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{statusMessage}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          Tenant
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={form.tenantKey}
            onChange={(e) => setForm((prev) => ({ ...prev, tenantKey: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          Destino
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={form.destination}
            onChange={(e) => setForm((prev) => ({ ...prev, destination: e.target.value as "SPLUNK_HEC" | "AWS_S3" }))}
          >
            <option value="SPLUNK_HEC">Splunk HEC (SIEM)</option>
            <option value="AWS_S3">AWS S3 (Bucket)</option>
          </select>
        </label>
        <label className="flex items-end gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
          />
          Exportacao habilitada
        </label>
      </div>

      {form.destination === "SPLUNK_HEC" ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Endpoint base (ex.: https://splunk.local:8088)
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.splunk.endpoint}
              onChange={(e) => setForm((prev) => ({ ...prev, splunk: { ...prev.splunk, endpoint: e.target.value } }))}
            />
          </label>
          <label className="text-sm">
            Token (secret)
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder={initialSettings.splunk.tokenMasked || "••••••"}
              value={form.splunk.token}
              onChange={(e) => setForm((prev) => ({ ...prev, splunk: { ...prev.splunk, token: e.target.value } }))}
            />
          </label>
          <label className="text-sm">
            Index (opcional)
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.splunk.index}
              onChange={(e) => setForm((prev) => ({ ...prev, splunk: { ...prev.splunk, index: e.target.value } }))}
            />
          </label>
          <label className="text-sm">
            Source
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.splunk.source}
              onChange={(e) => setForm((prev) => ({ ...prev, splunk: { ...prev.splunk, source: e.target.value } }))}
            />
          </label>
          <label className="text-sm md:col-span-2">
            Sourcetype
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.splunk.sourceType}
              onChange={(e) => setForm((prev) => ({ ...prev, splunk: { ...prev.splunk, sourceType: e.target.value } }))}
            />
          </label>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Region
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.s3.region}
              onChange={(e) => setForm((prev) => ({ ...prev, s3: { ...prev.s3, region: e.target.value } }))}
            />
          </label>
          <label className="text-sm">
            Bucket
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.s3.bucket}
              onChange={(e) => setForm((prev) => ({ ...prev, s3: { ...prev.s3, bucket: e.target.value } }))}
            />
          </label>
          <label className="text-sm">
            Prefixo
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.s3.prefix}
              onChange={(e) => setForm((prev) => ({ ...prev, s3: { ...prev.s3, prefix: e.target.value } }))}
            />
          </label>
          <label className="text-sm">
            Access Key ID (secret)
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder={initialSettings.s3.accessKeyIdMasked || "••••••"}
              value={form.s3.accessKeyId}
              onChange={(e) => setForm((prev) => ({ ...prev, s3: { ...prev.s3, accessKeyId: e.target.value } }))}
            />
          </label>
          <label className="text-sm">
            Secret Access Key (secret)
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder={initialSettings.s3.secretAccessKeyMasked || "••••••"}
              value={form.s3.secretAccessKey}
              onChange={(e) => setForm((prev) => ({ ...prev, s3: { ...prev.s3, secretAccessKey: e.target.value } }))}
            />
          </label>
          <label className="text-sm">
            Session Token (opcional)
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder={initialSettings.s3.sessionTokenMasked || "••••••"}
              value={form.s3.sessionToken}
              onChange={(e) => setForm((prev) => ({ ...prev, s3: { ...prev.s3, sessionToken: e.target.value } }))}
            />
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          className="rounded-lg bg-[#800020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#68001a] disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar configuracao"}
        </button>
        <span className="text-xs text-slate-500">Destino atual: {destinationLabel}</span>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-900">Exportar agora</p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            De
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={exportWindow.from}
              onChange={(e) => setExportWindow((prev) => ({ ...prev, from: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Ate
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={exportWindow.to}
              onChange={(e) => setExportWindow((prev) => ({ ...prev, to: e.target.value }))}
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void runExport()}
              disabled={running}
              className="w-full rounded-lg border border-[#800020] px-4 py-2 text-sm font-semibold text-[#800020] hover:bg-[#fff8e8] disabled:opacity-60"
            >
              {running ? "Exportando..." : "Executar exportacao"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Ultima execucao: {lastExport.at ? new Date(lastExport.at).toLocaleString("pt-BR") : "-"} | status: {lastExport.status || "-"} | {lastExport.message || "-"}
        </p>
      </div>
    </Card>
  );
}

