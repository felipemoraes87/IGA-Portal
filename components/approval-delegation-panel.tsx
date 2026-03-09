"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type DelegateOption = {
  id: string;
  name: string;
  email: string;
};

type DelegationItem = {
  id: string;
  delegatorId: string;
  delegateId: string;
  scope: "ANY" | "MANAGER" | "SYSTEM_OWNER" | "SR_OWNER";
  startsAt: string;
  endsAt: string;
  reason: string | null;
  active: boolean;
  delegator: { id: string; name: string; email: string };
  delegate: { id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
};

function toLocalDateTimeInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

export function ApprovalDelegationPanel({
  actorId,
  delegateOptions,
}: Readonly<{
  actorId: string;
  delegateOptions: DelegateOption[];
}>) {
  const [items, setItems] = useState<DelegationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const now = new Date();
  const oneWeekAhead = new Date();
  oneWeekAhead.setDate(oneWeekAhead.getDate() + 7);

  const [delegateId, setDelegateId] = useState("");
  const [startsAt, setStartsAt] = useState(toLocalDateTimeInputValue(now));
  const [endsAt, setEndsAt] = useState(toLocalDateTimeInputValue(oneWeekAhead));
  const [reason, setReason] = useState("");

  async function loadDelegations() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/approvals/delegations", { cache: "no-store" });
      const body = (await response.json()) as { data?: DelegationItem[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Falha ao carregar delegacoes");
      setItems(body.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar delegacoes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDelegations();
  }, []);

  async function createDelegation() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/approvals/delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delegateId,
          scope: "ANY",
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          reason: reason.trim() || null,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Falha ao criar delegacao");
      setSuccess("Delegacao temporaria criada com sucesso.");
      setDelegateId("");
      setReason("");
      await loadDelegations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar delegacao");
    } finally {
      setSubmitting(false);
    }
  }

  async function disableDelegation(id: string) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/approvals/delegations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: false,
          endsAt: new Date().toISOString(),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Falha ao encerrar delegacao");
      setSuccess("Delegacao encerrada com sucesso.");
      await loadDelegations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao encerrar delegacao");
    } finally {
      setSubmitting(false);
    }
  }

  const outgoing = useMemo(() => items.filter((item) => item.delegatorId === actorId), [items, actorId]);
  const incoming = useMemo(() => items.filter((item) => item.delegateId === actorId), [items, actorId]);
  const activeOutgoing = outgoing.filter((item) => item.active).length;
  const activeIncoming = incoming.filter((item) => item.active).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delegacoes ativas concedidas</p>
          <p className="mt-1 text-2xl font-bold text-[#800020]">{activeOutgoing}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delegacoes ativas recebidas</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{activeIncoming}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#f1e6c9] bg-[#fff8e8]/40 p-4">
        <p className="text-sm font-semibold text-slate-900">Delegacao temporaria de aprovacao</p>
        <p className="mt-1 text-xs text-slate-600">Use para cobertura de ferias/ausencia com janela definida e trilha de auditoria.</p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Delegar para</label>
            <select value={delegateId} onChange={(event) => setDelegateId(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {delegateOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({option.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Motivo</label>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="Ex.: Ferias de 10 dias"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Inicio</label>
            <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Fim</label>
            <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={submitting || !delegateId || !startsAt || !endsAt}
            onClick={createDelegation}
          >
            Criar delegacao
          </Button>
          <Button variant="secondary" disabled={loading || submitting} onClick={() => void loadDelegations()}>
            Atualizar lista
          </Button>
        </div>

        {error ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Minhas delegacoes</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full table-compact">
            <thead>
              <tr>
                <th>Status</th>
                <th>Tipo</th>
                <th>Delegador</th>
                <th>Delegado</th>
                <th>Inicio</th>
                <th>Fim</th>
                <th>Motivo</th>
                <th className="text-right">Acao</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 text-slate-800">
                  <td>
                    <span className={item.active ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700" : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"}>
                      {item.active ? "Ativa" : "Encerrada"}
                    </span>
                  </td>
                  <td>{item.delegatorId === actorId ? "Concedida" : "Recebida"}</td>
                  <td>{item.delegator.name}</td>
                  <td>{item.delegate.name}</td>
                  <td>{formatDate(new Date(item.startsAt))}</td>
                  <td>{formatDate(new Date(item.endsAt))}</td>
                  <td>{item.reason || "-"}</td>
                  <td className="text-right">
                    {item.delegatorId === actorId && item.active ? (
                      <Button variant="secondary" disabled={submitting} onClick={() => void disableDelegation(item.id)}>
                        Encerrar
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? <p className="py-3 text-sm text-slate-500">Nenhuma delegacao registrada.</p> : null}
        </div>
      </div>
    </div>
  );
}
