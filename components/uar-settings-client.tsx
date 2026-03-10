"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";

type PublicUarSettings = {
  id: string;
  tenantKey: string;
  systemReviewPeriodDays: number;
  srReviewPeriodDays: number;
  brReviewPeriodDays: number;
  directAccessReviewPeriodDays: number;
  reviewLookbackDays: number;
  reviewWarningWindowDays: number;
  overdueGraceDays: number;
  notifyOwnersBeforeDays: number;
  autoRevokeOnOverdue: boolean;
  requireJustificationOnRenewal: boolean;
  updatedAt: string | Date;
};

export function UarSettingsClient({ initialSettings }: Readonly<{ initialSettings: PublicUarSettings }>) {
  const [form, setForm] = useState({
    tenantKey: initialSettings.tenantKey,
    systemReviewPeriodDays: initialSettings.systemReviewPeriodDays,
    srReviewPeriodDays: initialSettings.srReviewPeriodDays,
    brReviewPeriodDays: initialSettings.brReviewPeriodDays,
    directAccessReviewPeriodDays: initialSettings.directAccessReviewPeriodDays,
    reviewLookbackDays: initialSettings.reviewLookbackDays,
    reviewWarningWindowDays: initialSettings.reviewWarningWindowDays,
    overdueGraceDays: initialSettings.overdueGraceDays,
    notifyOwnersBeforeDays: initialSettings.notifyOwnersBeforeDays,
    autoRevokeOnOverdue: initialSettings.autoRevokeOnOverdue,
    requireJustificationOnRenewal: initialSettings.requireJustificationOnRenewal,
  });
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(initialSettings.updatedAt);

  async function saveSettings() {
    setSaving(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/admin/uar/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatusMessage(payload.error || "Falha ao salvar parametros de UAR.");
        return;
      }
      setUpdatedAt(payload.data?.updatedAt || new Date().toISOString());
      setStatusMessage("Parametros de UAR salvos.");
    } catch {
      setStatusMessage("Erro de rede ao salvar parametros de UAR.");
    } finally {
      setSaving(false);
    }
  }

  function updateNumberField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: Number(value) }));
  }

  return (
    <Card className="border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Parametros da campanha UAR</h3>
          <p className="mt-1 text-sm text-slate-500">Defina a politica operacional de revisao para sistemas, SRs, BRs e acessos diretos.</p>
        </div>
        <p className="text-xs text-slate-500">Ultima atualizacao: {new Date(updatedAt).toLocaleString("pt-BR")}</p>
      </div>

      {statusMessage ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{statusMessage}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">
          Revisao de Sistema (dias)
          <input type="number" min={30} max={1095} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.systemReviewPeriodDays} onChange={(e) => updateNumberField("systemReviewPeriodDays", e.target.value)} />
        </label>
        <label className="text-sm">
          Revisao de SR (dias)
          <input type="number" min={30} max={1095} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.srReviewPeriodDays} onChange={(e) => updateNumberField("srReviewPeriodDays", e.target.value)} />
        </label>
        <label className="text-sm">
          Revisao de BR (dias)
          <input type="number" min={30} max={1095} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.brReviewPeriodDays} onChange={(e) => updateNumberField("brReviewPeriodDays", e.target.value)} />
        </label>
        <label className="text-sm">
          Revisao de acesso direto (dias)
          <input type="number" min={7} max={365} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.directAccessReviewPeriodDays} onChange={(e) => updateNumberField("directAccessReviewPeriodDays", e.target.value)} />
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">
          Janela de analisadas recentes (dias)
          <input type="number" min={7} max={365} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.reviewLookbackDays} onChange={(e) => updateNumberField("reviewLookbackDays", e.target.value)} />
        </label>
        <label className="text-sm">
          Janela de aviso/prioridade (dias)
          <input type="number" min={7} max={180} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.reviewWarningWindowDays} onChange={(e) => updateNumberField("reviewWarningWindowDays", e.target.value)} />
        </label>
        <label className="text-sm">
          Tolerancia de atraso (dias)
          <input type="number" min={0} max={90} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.overdueGraceDays} onChange={(e) => updateNumberField("overdueGraceDays", e.target.value)} />
        </label>
        <label className="text-sm">
          Notificar owners antes (dias)
          <input type="number" min={1} max={90} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.notifyOwnersBeforeDays} onChange={(e) => updateNumberField("notifyOwnersBeforeDays", e.target.value)} />
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700">
          <input type="checkbox" checked={form.autoRevokeOnOverdue} onChange={(e) => setForm((prev) => ({ ...prev, autoRevokeOnOverdue: e.target.checked }))} />
          Revogar automaticamente itens vencidos sem revisao
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700">
          <input type="checkbox" checked={form.requireJustificationOnRenewal} onChange={(e) => setForm((prev) => ({ ...prev, requireJustificationOnRenewal: e.target.checked }))} />
          Exigir justificativa na renovacao
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void saveSettings()} disabled={saving} className="rounded-lg bg-[#800020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#68001a] disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar parametros"}
        </button>
        <p className="text-xs text-slate-500">Esses parametros definem a politica usada pelo time de IAM na campanha de revisao.</p>
      </div>
    </Card>
  );
}
