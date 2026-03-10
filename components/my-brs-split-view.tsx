"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toFriendlyLabel } from "@/lib/utils";

type BrRow = {
  id: string;
  name: string;
  technicalId: string;
  totalSrs: number;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  criticalSrCount: number;
  status: string;
  company: string;
  ownerName: string;
  associationCriteria: string;
  lastRevisionDate: string;
  nextRevisionDate: string;
};

export function MyBrsSplitView({ rows }: Readonly<{ rows: BrRow[] }>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );

  return (
    <div className={selected ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_420px]" : ""}>
      <div className="overflow-x-auto">
        <table className="min-w-full table-compact">
          <thead>
            <tr>
              <th>Business Role</th>
              <th>Technical ID</th>
              <th>Total SRs</th>
              <th>Usuarios vinculados</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = row.id === selectedId;
              return (
                <tr key={row.id} className={`border-b border-slate-100 text-slate-800 ${isSelected ? "bg-[#fff8e8]" : ""}`}>
                  <td>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className="cursor-pointer text-left text-sm font-semibold text-[#800020] hover:underline"
                    >
                      {toFriendlyLabel(row.name, "Sem nome")}
                    </button>
                  </td>
                  <td>{toFriendlyLabel(row.technicalId, "-")}</td>
                  <td>{row.totalSrs}</td>
                  <td>{row.totalUsers}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-3 py-6 text-sm text-slate-500">Voce ainda nao possui BRs vinculadas como owner.</p> : null}
      </div>

      {selected ? (
        <aside className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between rounded-t-xl bg-[#800020] px-4 py-3 text-white">
            <h3 className="text-lg font-bold">Resumo da BR</h3>
            <button type="button" onClick={() => setSelectedId(null)} className="rounded-md px-2 py-1 text-white/90 hover:bg-white/10">
              Fechar
            </button>
          </div>
          <div className="space-y-4 p-4">
            <section className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500">Nome</p>
                <p className="font-semibold text-slate-900">{toFriendlyLabel(selected.name, "Sem nome")}</p>
              </div>
              <div>
                <p className="text-slate-500">Owner</p>
                <p className="font-medium text-slate-900">{toFriendlyLabel(selected.ownerName, "-")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-500">Status</p>
                  <p className="font-medium text-slate-900">{toFriendlyLabel(selected.status, "-")}</p>
                </div>
                <div>
                  <p className="text-slate-500">Empresa</p>
                  <p className="font-medium text-slate-900">{toFriendlyLabel(selected.company, "-")}</p>
                </div>
              </div>
            </section>

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Contexto operacional</p>
              <div className="space-y-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-800">Usuarios ativos</p>
                  <p className="text-slate-600">{selected.activeUsers}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-800">Usuarios inativos</p>
                  <p className="text-slate-600">{selected.inactiveUsers}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-800">SRs criticas</p>
                  <p className="text-slate-600">{selected.criticalSrCount}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-800">Proxima revisao</p>
                  <p className="text-slate-600">{toFriendlyLabel(selected.nextRevisionDate, "-")}</p>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-800">Criterio de associacao</p>
                <p className="text-slate-600">{toFriendlyLabel(selected.associationCriteria, "Sem criterio informado.")}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-800">Ultima revisao</p>
                <p className="text-slate-600">{toFriendlyLabel(selected.lastRevisionDate, "-")}</p>
              </div>
            </section>

            <section>
              <Link
                href={`/my-brs/${encodeURIComponent(selected.id)}`}
                className="inline-flex w-full items-center justify-center rounded-lg border border-[#800020] px-4 py-2 text-sm font-semibold text-[#800020] hover:bg-[#fff8e8]"
              >
                Abrir BR completa
              </Link>
            </section>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
