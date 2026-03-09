"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { resolveSystemThumb } from "@/lib/system-logo";
import { formatDate } from "@/lib/utils";

type RequestDetail = {
  id: string;
  status: string;
  justification: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  permission: { name: string; system: { name: string } };
  requester: { name: string; email: string };
  targetUser: { name: string; email: string };
  approver: { name: string; email: string } | null;
  approvals: Array<{ id: string; decision: string; comment: string | null; decidedAt: string; approver: { name: string } }>;
  execution: { status: string; startedAt: string; finishedAt: string | null; errorMessage: string | null } | null;
};
export function RequestDetailLive({ requestId }: Readonly<{ requestId: string }>) {
  const [data, setData] = useState<RequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(`/api/requests/${requestId}`);
        const body = (await response.json()) as { data?: RequestDetail; error?: string };
        if (!response.ok || !body.data) {
          throw new Error(body.error || "Falha ao carregar solicitaÃ§Ã£o");
        }
        if (active) setData(body.data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Falha ao carregar");
      }
    }

    load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [requestId]);

  if (error) return <Card>{error}</Card>;
  if (!data) return <Card>Carregando detalhes...</Card>;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
        <p className="mt-2 text-2xl font-bold text-[#800020]">{data.status}</p>
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <img src={resolveSystemThumb(data.permission.system.name)} alt={`${data.permission.system.name} logo`} className="h-4 w-4 rounded-sm border border-[#e7d7ac] bg-white p-0.5" />
          <span>{data.permission.system.name} - {data.permission.name}</span>
        </p>
        <p className="mt-2 text-sm text-slate-600">Solicitante: {data.requester.name} ({data.requester.email})</p>
        <p className="text-sm text-slate-600">Alvo: {data.targetUser.name} ({data.targetUser.email})</p>
        <p className="text-sm text-slate-600">Aprovador: {data.approver ? `${data.approver.name} (${data.approver.email})` : "NÃ£o definido"}</p>
        <p className="mt-2 text-xs text-slate-500">Idempotency Key: {data.idempotencyKey}</p>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-900">Justificativa</h3>
        <p className="mt-2 text-sm text-slate-700">{data.justification}</p>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-900">AprovaÃ§Ãµes</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {data.approvals.map((approval) => (
            <li key={approval.id} className="rounded-xl border border-[#f1e6c9] bg-[#fff8e8] p-3">
              <p className="font-semibold text-[#4a0012]">{approval.decision}</p>
              <p className="text-slate-700">Aprovador: {approval.approver.name}</p>
              <p className="text-slate-700">ComentÃ¡rio: {approval.comment || "-"}</p>
              <p className="text-xs text-slate-500">{formatDate(new Date(approval.decidedAt))}</p>
            </li>
          ))}
          {data.approvals.length === 0 ? <li className="text-slate-500">Sem decisÃµes registradas.</li> : null}
        </ul>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-900">ExecuÃ§Ã£o</h3>
        {data.execution ? (
          <div className="mt-2 text-sm text-slate-700">
            <p>Status: {data.execution.status}</p>
            <p>InÃ­cio: {formatDate(new Date(data.execution.startedAt))}</p>
            <p>Fim: {data.execution.finishedAt ? formatDate(new Date(data.execution.finishedAt)) : "-"}</p>
            <p>Erro: {data.execution.errorMessage || "-"}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">ExecuÃ§Ã£o ainda nÃ£o iniciada.</p>
        )}
      </Card>
    </div>
  );
}


