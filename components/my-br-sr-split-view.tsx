"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { resolveSystemThumb } from "@/lib/system-logo";
import { formatDate, toFriendlyLabel } from "@/lib/utils";

type SrRow = {
  permissionId: string;
  name: string;
  description: string;
  systemId: string;
  systemName: string;
  systemCriticality: string;
  srOwnerName: string;
  systemOwnerName: string;
  origin: string;
  risk: string;
  updatedAt: string;
  assignmentsCount: number;
  pendingCount: number;
  latestRequestAt: string;
};

export function MyBrSrSplitView({ rows }: Readonly<{ rows: SrRow[] }>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.permissionId === selectedId) ?? null,
    [rows, selectedId],
  );

  return (
    <div className={selected ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_420px]" : ""}>
      <div className="overflow-x-auto">
        <table className="min-w-full table-compact">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Sistema</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = row.permissionId === selectedId;
              return (
                <tr key={row.permissionId} className={`border-b border-slate-100 text-slate-800 ${isSelected ? "bg-[#fff8e8]" : ""}`}>
                  <td>
                    <div className="relative inline-block group">
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.permissionId)}
                        className="cursor-pointer text-left text-sm font-semibold text-[#800020] hover:underline"
                        aria-label={`${toFriendlyLabel(row.name, row.permissionId)}. ${toFriendlyLabel(row.description, "Sem descricao da SR.")}`}
                      >
                        {toFriendlyLabel(row.name, row.permissionId)}
                      </button>
                      <div className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-80 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-md group-hover:block">
                        {toFriendlyLabel(row.description, "Sem descricao da SR.")}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="flex items-center gap-2">
                      <img src={resolveSystemThumb(row.systemName)} alt={`${row.systemName} logo`} className="h-4 w-4 rounded-sm border border-[#e7d7ac] bg-white p-0.5" />
                      {toFriendlyLabel(row.systemName, row.systemId)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-3 py-6 text-sm text-slate-500">Sem SRs vinculadas.</p> : null}
      </div>

      {selected ? (
        <aside className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between rounded-t-xl bg-[#800020] px-4 py-3 text-white">
            <h3 className="text-lg font-bold">Detalhes da Role</h3>
            <button type="button" onClick={() => setSelectedId(null)} className="rounded-md px-2 py-1 text-white/90 hover:bg-white/10">
              Fechar
            </button>
          </div>
          <div className="space-y-6 p-4">
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Informacoes Gerais</p>
              <div className="mt-2 space-y-3 text-sm">
                <div>
                  <p className="text-slate-500">Nome</p>
                  <p className="font-semibold text-slate-900">{toFriendlyLabel(selected.name, selected.permissionId)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Descricao</p>
                  <p className="text-slate-800">{toFriendlyLabel(selected.description, "Sem descricao da SR.")}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-slate-500">Owner SR</p>
                    <p className="font-medium text-slate-900">{toFriendlyLabel(selected.srOwnerName, "-")}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Owner Sistema</p>
                    <p className="font-medium text-slate-900">{toFriendlyLabel(selected.systemOwnerName, "-")}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Ultima revisao</p>
                    <p className="font-medium text-slate-900">{toFriendlyLabel(selected.updatedAt, "-")}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Sistema</p>
                    <p className="font-medium text-slate-900">{toFriendlyLabel(selected.systemName, selected.systemId)}</p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contexto de Governanca</p>
              <div className="mt-2 space-y-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-800">Vinculacoes ativas</p>
                  <p className="text-slate-600">{selected.assignmentsCount}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-800">Pendencias de aprovacao</p>
                  <p className="text-slate-600">{selected.pendingCount}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-800">Ultima solicitacao</p>
                  <p className="text-slate-600">{selected.latestRequestAt ? formatDate(new Date(selected.latestRequestAt)) : "-"}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-800">Criticidade / Risco</p>
                  <p className="text-slate-600">{selected.systemCriticality} / {toFriendlyLabel(selected.risk, "-")}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-800">Origem</p>
                  <p className="text-slate-600">{toFriendlyLabel(selected.origin, "-")}</p>
                </div>
              </div>
            </section>

            <section>
              <Link href={`/my-srs/${encodeURIComponent(selected.permissionId)}`} className="inline-flex w-full items-center justify-center rounded-lg border border-[#800020] px-4 py-2 text-sm font-semibold text-[#800020] hover:bg-[#fff8e8]">
                Abrir detalhe completo da SR
              </Link>
            </section>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
