"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";

type UserOption = Readonly<{
  id: string;
  name: string;
  email: string;
  active: boolean;
  role: "USER" | "MANAGER" | "ADMIN";
  roleAssignments: Array<{ role: "USER" | "MANAGER" | "ADMIN" }>;
}>;
type BusinessRoleOption = {
  id: string;
  label: string;
};
type PermissionOption = {
  id: string;
  label: string;
  system: string;
};
type Props = Readonly<{
  users: UserOption[];
  businessRoles: BusinessRoleOption[];
  permissions: PermissionOption[];
}>;
type ApiResult = {
  error?: string;
  data?: {
    action: string;
    summary?: string;
    message?: string;
    createdId?: string;
  };
};
export function AdminOperationPanel({ users, businessRoles, permissions }: Props) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [manualUserId, setManualUserId] = useState(users[0]?.id ?? "");
  const [manualPermissionId, setManualPermissionId] = useState(permissions[0]?.id ?? "");
  const [manualOperation, setManualOperation] = useState<"GRANT" | "REVOKE">("GRANT");
  const [manualNote, setManualNote] = useState("");

  const [reconBrId, setReconBrId] = useState(businessRoles[0]?.id ?? "");
  const [reconBrNote, setReconBrNote] = useState("");

  const [reconSrId, setReconSrId] = useState(permissions[0]?.id ?? "");
  const [reconSrNote, setReconSrNote] = useState("");

  const defaultDelegate = users.find((item) => item.active && (item.role === "MANAGER" || item.role === "ADMIN"))?.id ?? "";
  const [delegationDelegatorId, setDelegationDelegatorId] = useState(users[0]?.id ?? "");
  const [delegationDelegateId, setDelegationDelegateId] = useState(defaultDelegate);
  const [delegationStartsAt, setDelegationStartsAt] = useState(() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  });
  const [delegationEndsAt, setDelegationEndsAt] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const tzOffset = nextWeek.getTimezoneOffset() * 60 * 1000;
    return new Date(nextWeek.getTime() - tzOffset).toISOString().slice(0, 16);
  });
  const [delegationReason, setDelegationReason] = useState("");

  const permissionOptions = useMemo(
    () =>
      permissions.map((item) => (
        <option key={item.id} value={item.id}>
          {item.system} - {item.label}
        </option>
      )),
    [permissions],
  );

  const delegateCandidates = useMemo(
    () =>
      users.filter((item) => {
        if (!item.active) return false;
        if (item.role === "MANAGER" || item.role === "ADMIN") return true;
        return item.roleAssignments.some((assignment) => assignment.role === "MANAGER" || assignment.role === "ADMIN");
      }),
    [users],
  );

  async function runOperation(payload: Record<string, string>, actionKey: string) {
    setLoadingAction(actionKey);
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/operation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as ApiResult;
      if (!response.ok) {
        throw new Error(body.error || "Falha na operacao");
      }
      setFeedback(body.data?.summary || body.data?.message || "Operacao executada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na operacao");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <h3 className="text-lg font-bold text-slate-900">Gerenciar SR em user</h3>
        <p className="mt-1 text-sm text-slate-500">Executa atribuicao ou revogacao manual de SR DIRECT para testes e ajustes operacionais.</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            runOperation(
              {
                action: "MANAGE_SR_FOR_USER",
                operation: manualOperation,
                userId: manualUserId,
                permissionId: manualPermissionId,
                note: manualNote,
              },
              "MANAGE_SR_FOR_USER",
            );
          }}
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Acao</label>
          <select value={manualOperation} onChange={(event) => setManualOperation(event.target.value as "GRANT" | "REVOKE")} className="w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            <option value="GRANT">Grant</option>
            <option value="REVOKE">Revoke</option>
          </select>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">User</label>
          <select value={manualUserId} onChange={(event) => setManualUserId(event.target.value)} className="w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.email})
              </option>
            ))}
          </select>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">System role (SR)</label>
          <select
            value={manualPermissionId}
            onChange={(event) => setManualPermissionId(event.target.value)}
            className="w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
          >
            {permissionOptions}
          </select>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nota (opcional)</label>
          <textarea
            value={manualNote}
            onChange={(event) => setManualNote(event.target.value)}
            className="min-h-20 w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
            placeholder="Motivo ou contexto da acao manual"
          />

          <button
            type="submit"
            disabled={loadingAction === "MANAGE_SR_FOR_USER" || !manualUserId || !manualPermissionId}
            className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#68001a] disabled:opacity-60"
          >
            {loadingAction === "MANAGE_SR_FOR_USER" ? "Executando..." : manualOperation === "GRANT" ? "Conceder SR" : "Revogar SR"}
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-slate-900">Delegacao temporaria (IAM)</h3>
        <p className="mt-1 text-sm text-slate-500">
          Cria delegacao temporaria de aprovacao para cobertura operacional, inclusive quando o delegador esta sem acesso.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            runOperation(
              {
                action: "CREATE_APPROVAL_DELEGATION",
                delegatorId: delegationDelegatorId,
                delegateId: delegationDelegateId,
                startsAt: new Date(delegationStartsAt).toISOString(),
                endsAt: new Date(delegationEndsAt).toISOString(),
                reason: delegationReason,
              },
              "CREATE_APPROVAL_DELEGATION",
            );
          }}
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Delegador</label>
          <select value={delegationDelegatorId} onChange={(event) => setDelegationDelegatorId(event.target.value)} className="w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.email}) {item.active ? "" : "[INATIVO]"}
              </option>
            ))}
          </select>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Delegado (aprovador ativo)</label>
          <select value={delegationDelegateId} onChange={(event) => setDelegationDelegateId(event.target.value)} className="w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            {delegateCandidates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.email})
              </option>
            ))}
          </select>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Inicio</label>
              <input
                type="datetime-local"
                value={delegationStartsAt}
                onChange={(event) => setDelegationStartsAt(event.target.value)}
                className="w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Fim</label>
              <input
                type="datetime-local"
                value={delegationEndsAt}
                onChange={(event) => setDelegationEndsAt(event.target.value)}
                className="w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Motivo (obrigatorio para auditoria)</label>
          <textarea
            value={delegationReason}
            onChange={(event) => setDelegationReason(event.target.value)}
            className="min-h-20 w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
            placeholder="Ex.: Cobertura de ferias no periodo"
          />

          <button
            type="submit"
            disabled={
              loadingAction === "CREATE_APPROVAL_DELEGATION" ||
              !delegationDelegatorId ||
              !delegationDelegateId ||
              !delegationStartsAt ||
              !delegationEndsAt ||
              delegationReason.trim().length < 5
            }
            className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#68001a] disabled:opacity-60"
          >
            {loadingAction === "CREATE_APPROVAL_DELEGATION" ? "Executando..." : "Criar delegacao"}
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-slate-900">Recon de BR</h3>
        <p className="mt-1 text-sm text-slate-500">Sincroniza relacionamento user x BR com base no snapshot do orquestrador.</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            runOperation(
              {
                action: "RECON_BR",
                businessRoleId: reconBrId,
                note: reconBrNote,
              },
              "RECON_BR",
            );
          }}
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Business role</label>
          <select value={reconBrId} onChange={(event) => setReconBrId(event.target.value)} className="w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            {businessRoles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nota (opcional)</label>
          <textarea
            value={reconBrNote}
            onChange={(event) => setReconBrNote(event.target.value)}
            className="min-h-20 w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
            placeholder="Motivo da reconciliacao"
          />

          <button
            type="submit"
            disabled={loadingAction === "RECON_BR" || !reconBrId}
            className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#68001a] disabled:opacity-60"
          >
            {loadingAction === "RECON_BR" ? "Executando..." : "Executar recon BR"}
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-slate-900">Recon de SR</h3>
        <p className="mt-1 text-sm text-slate-500">Sincroniza atribuicoes BR da SR com base em BR x SR x users ativos.</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            runOperation(
              {
                action: "RECON_SR",
                permissionId: reconSrId,
                note: reconSrNote,
              },
              "RECON_SR",
            );
          }}
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">System role (SR)</label>
          <select value={reconSrId} onChange={(event) => setReconSrId(event.target.value)} className="w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            {permissionOptions}
          </select>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nota (opcional)</label>
          <textarea
            value={reconSrNote}
            onChange={(event) => setReconSrNote(event.target.value)}
            className="min-h-20 w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
            placeholder="Motivo da reconciliacao"
          />

          <button
            type="submit"
            disabled={loadingAction === "RECON_SR" || !reconSrId}
            className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#68001a] disabled:opacity-60"
          >
            {loadingAction === "RECON_SR" ? "Executando..." : "Executar recon SR"}
          </button>
        </form>
      </Card>

      {feedback ? <p className="lg:col-span-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{feedback}</p> : null}
      {error ? <p className="lg:col-span-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}


