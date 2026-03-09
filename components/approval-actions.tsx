"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resolveSystemThumb } from "@/lib/system-logo";

type ApprovalItem = {
  id: string;
  requester: { name: string; email: string };
  targetUser: { name: string; email: string };
  permission: { name: string; system: { name: string } };
  justification: string;
};
export function ApprovalActions({ data }: Readonly<{ data: ApprovalItem[] }>) {
  const [items, setItems] = useState(data);
  const [commentById, setCommentById] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(requestId: string, decision: "approve" | "reject") {
    setLoadingId(requestId);
    setError(null);
    try {
      const response = await fetch(`/api/requests/${requestId}/${decision}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: commentById[requestId] || "" }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Falha ao processar aprovaÃ§Ã£o");
      setItems((prev) => prev.filter((item) => item.id !== requestId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao processar aprovaÃ§Ã£o");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {items.map((item) => (
        <div key={item.id} className="vision-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <img src={resolveSystemThumb(item.permission.system.name)} alt={`${item.permission.system.name} logo`} className="h-4 w-4 rounded-sm border border-[#e7d7ac] bg-white p-0.5" />
                {item.permission.system.name}
              </p>
              <p className="text-sm font-semibold text-[#800020]">{item.permission.name}</p>
            </div>
            <span className="vision-status vision-status-pending">
              <span className="vision-status-dot bg-amber-500" />
              Pendente
            </span>
          </div>

          <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            <p>
              <span className="font-semibold text-slate-800">Solicitante:</span> {item.requester.name} ({item.requester.email})
            </p>
            <p>
              <span className="font-semibold text-slate-800">Alvo:</span> {item.targetUser.name} ({item.targetUser.email})
            </p>
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Justificativa</p>
            <p className="mt-1 text-sm text-slate-700">{item.justification}</p>
          </div>

          <div className="mt-3">
            <Textarea
              rows={2}
              placeholder="Comentario opcional"
              value={commentById[item.id] || ""}
              onChange={(event) => setCommentById((prev) => ({ ...prev, [item.id]: event.target.value }))}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={loadingId === item.id} className="min-w-32" onClick={() => decide(item.id, "approve")}>
              Aprovar
            </Button>
            <Button variant="danger" disabled={loadingId === item.id} className="min-w-32" onClick={() => decide(item.id, "reject")}>
              Reprovar
            </Button>
          </div>
        </div>
      ))}
      {items.length === 0 ? <p className="text-sm text-slate-500">Sem aprovacoes pendentes.</p> : null}
    </div>
  );
}


