"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Cloud,
  Copy,
  Database,
  Github,
  MessageSquare,
  Shield,
  ShoppingBag,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resolveSystemThumb } from "@/lib/system-logo";
import { toFriendlyLabel } from "@/lib/utils";

type UserOption = Readonly<{
  id: string;
  label: string;
}>;
type SystemOption = Readonly<{
  id: string;
  name: string;
  permissions: { id: string; name: string; description?: string }[];
}>;
type FormProps = Readonly<{
  actorRole: "USER" | "MANAGER" | "ADMIN";
  actorUserId: string;
  users: UserOption[];
  mirrorUsers: UserOption[];
  systems: SystemOption[];
}>;
function resolveSystemIcon(systemName: string): LucideIcon {
  const normalized = systemName.toLowerCase();
  if (normalized.includes("gcp") || normalized.includes("google")) return Cloud;
  if (normalized.includes("slack")) return MessageSquare;
  if (normalized.includes("github")) return Github;
  if (normalized.includes("jira")) return Briefcase;
  if (normalized.includes("sap")) return Database;
  return Shield;
}

type MirrorPermission = Readonly<{
  id: string;
  permissionId: string;
  systemName: string;
  permissionName: string;
}>;

type MirrorPermissionsState = Readonly<{
  mirrorPermissions: MirrorPermission[];
  mirrorError: string | null;
}>;

function useMirrorPermissions(requestType: "SINGLE" | "MIRROR", mirrorFromUserId: string): MirrorPermissionsState {
  const [mirrorPermissions, setMirrorPermissions] = useState<MirrorPermission[]>([]);
  const [mirrorError, setMirrorError] = useState<string | null>(null);

  useEffect(() => {
    if (requestType !== "MIRROR" || !mirrorFromUserId) return;

    let cancelled = false;

    fetch(`/api/users/${encodeURIComponent(mirrorFromUserId)}/additional-accesses`)
      .then(async (response) => {
        const body = (await response.json()) as { error?: string; data?: MirrorPermission[] };
        if (!response.ok) throw new Error(body.error || "Falha ao carregar acessos da origem");
        if (!cancelled) setMirrorPermissions(body.data || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setMirrorPermissions([]);
        setMirrorError(err instanceof Error ? err.message : "Falha ao carregar acessos da origem");
      })
      .finally(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [requestType, mirrorFromUserId]);

  return { mirrorPermissions, mirrorError };
}

function buildRequestPayload(args: {
  requestType: "SINGLE" | "MIRROR";
  finalTargetUserId: string;
  selectedPermissionIds: string[];
  mirrorFromUserId: string;
  accessDurationByPermissionId: Record<string, 1 | 3 | 6 | 12>;
  justification: string;
}) {
  return {
    requestType: args.requestType,
    targetUserId: args.finalTargetUserId,
    permissionIds: args.requestType === "SINGLE" ? args.selectedPermissionIds : undefined,
    mirrorFromUserId: args.requestType === "MIRROR" ? args.mirrorFromUserId : undefined,
    accessDurationByPermissionId:
      args.requestType === "SINGLE"
        ? Object.fromEntries(
            args.selectedPermissionIds.map((permissionId) => [
              permissionId,
              args.accessDurationByPermissionId[permissionId] ?? 6,
            ]),
          )
        : undefined,
    justification: args.justification,
  };
}

export function NewRequestForm({ actorRole, actorUserId, users, mirrorUsers, systems }: FormProps) { // NOSONAR
  const ACCESS_DURATION_OPTIONS = [1, 3, 6, 12] as const;
  const SYSTEMS_PER_PAGE = 10;
  type AccessDurationMonths = (typeof ACCESS_DURATION_OPTIONS)[number];
  const router = useRouter();
  const [targetMode, setTargetMode] = useState<"SELF" | "OTHER">("SELF");
  const [targetUserId, setTargetUserId] = useState(actorUserId);
  const [requestType, setRequestType] = useState<"SINGLE" | "MIRROR">("SINGLE");
  const [targetQuery, setTargetQuery] = useState("");
  const [systemQuery, setSystemQuery] = useState("");
  const [systemsPage, setSystemsPage] = useState(1);
  const [selectedSystemId, setSelectedSystemId] = useState(systems[0]?.id ?? "");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [mirrorFromUserId, setMirrorFromUserId] = useState(actorUserId);
  const [mirrorQuery, setMirrorQuery] = useState("");
  const [justification, setJustification] = useState("");
  const [accessDurationByPermissionId, setAccessDurationByPermissionId] = useState<Record<string, AccessDurationMonths>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { mirrorPermissions, mirrorError } = useMirrorPermissions(requestType, mirrorFromUserId);
  const mirrorLoading = requestType === "MIRROR" && !mirrorError && mirrorPermissions.length === 0;

  const canRequestForOther = true;
  const filteredSystems = useMemo(() => {
    const q = systemQuery.trim().toLowerCase();
    if (!q) return systems;
    return systems.filter((system) => system.name.toLowerCase().includes(q));
  }, [systems, systemQuery]);
  const totalSystemsPages = Math.max(1, Math.ceil(filteredSystems.length / SYSTEMS_PER_PAGE));
  const paginatedSystems = useMemo(() => {
    const start = (systemsPage - 1) * SYSTEMS_PER_PAGE;
    return filteredSystems.slice(start, start + SYSTEMS_PER_PAGE);
  }, [filteredSystems, systemsPage]);

  const selectedSystem = filteredSystems.find((system) => system.id === selectedSystemId) || filteredSystems[0] || systems[0];

  const selectedPermissions = useMemo(() => {
    const map = new Map<string, { systemName: string; id: string; name: string }>();
    for (const system of systems) {
      for (const permission of system.permissions) {
        if (selectedPermissionIds.includes(permission.id)) {
          map.set(permission.id, {
            systemName: system.name,
            id: permission.id,
            name: permission.name,
          });
        }
      }
    }
    return [...map.values()];
  }, [selectedPermissionIds, systems]);

  const filteredTargetUsers = useMemo(() => {
    const q = targetQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((item) => item.label.toLowerCase().includes(q));
  }, [users, targetQuery]);

  const filteredMirrorUsers = useMemo(() => {
    const q = mirrorQuery.trim().toLowerCase();
    if (!q) return mirrorUsers;
    return mirrorUsers.filter((item) => item.label.toLowerCase().includes(q));
  }, [mirrorUsers, mirrorQuery]);

  useEffect(() => {
    if (targetMode !== "OTHER") return;
    if (filteredTargetUsers.length === 0) return;
    const hasCurrent = filteredTargetUsers.some((item) => item.id === targetUserId);
    if (!hasCurrent) {
      setTargetUserId(filteredTargetUsers[0].id);
    }
  }, [targetMode, filteredTargetUsers, targetUserId]);

  useEffect(() => {
    setSystemsPage(1);
  }, [systemQuery]);

  useEffect(() => {
    if (systemsPage > totalSystemsPages) {
      setSystemsPage(totalSystemsPages);
    }
  }, [systemsPage, totalSystemsPages]);

  useEffect(() => {
    if (requestType !== "MIRROR") return;
    if (filteredMirrorUsers.length === 0) return;
    const hasCurrent = filteredMirrorUsers.some((item) => item.id === mirrorFromUserId);
    if (!hasCurrent) {
      setMirrorFromUserId(filteredMirrorUsers[0].id);
    }
  }, [requestType, filteredMirrorUsers, mirrorFromUserId]);

  function togglePermission(permissionId: string) {
    setSelectedPermissionIds((prev) => {
      if (prev.includes(permissionId)) {
        setAccessDurationByPermissionId((prevMap) => {
          const next = { ...prevMap };
          delete next[permissionId];
          return next;
        });
        return prev.filter((id) => id !== permissionId);
      }
      setAccessDurationByPermissionId((prevMap) => ({ ...prevMap, [permissionId]: prevMap[permissionId] ?? 6 }));
      return [...prev, permissionId];
    });
  }

  function setPermissionDuration(permissionId: string, durationMonths: AccessDurationMonths) {
    setAccessDurationByPermissionId((prev) => ({ ...prev, [permissionId]: durationMonths }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const finalTargetUserId = targetMode === "SELF" ? actorUserId : targetUserId;
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildRequestPayload({
            requestType,
            finalTargetUserId,
            selectedPermissionIds,
            mirrorFromUserId,
            accessDurationByPermissionId,
            justification,
          }),
        ),
      });
      const body = (await response.json()) as {
        error?: string;
        data?: { createdCount: number; firstRequestId?: string };
      };
      if (!response.ok || !body.data) {
        throw new Error(body.error || "Falha ao criar solicitacao");
      }

      if (body.data.createdCount === 1 && body.data.firstRequestId) {
        router.push(`/requests/${body.data.firstRequestId}`);
      } else {
        router.push("/my-requests");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar solicitacao");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#f1e6c9] bg-[#fff8e8] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Destino</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setTargetMode("SELF");
                setTargetUserId(actorUserId);
              }}
              className={`rounded-xl border px-4 py-4 text-left transition ${
                targetMode === "SELF" ? "border-[#800020] bg-[#800020] text-white" : "border-[#e7d7ac] bg-white text-[#4a0012] hover:border-[#c5a059]"
              }`}
            >
              <span className="flex items-center gap-3 text-base font-semibold">
                <UserRound className="h-7 w-7" />
                <span>Para mim</span>
              </span>
              <span className={`mt-1 block text-xs ${targetMode === "SELF" ? "text-[#f7e8c4]" : "text-slate-500"}`}>Solicitacao para sua propria conta.</span>
            </button>
            <button
              type="button"
              disabled={!canRequestForOther}
              onClick={() => setTargetMode("OTHER")}
              className={`rounded-xl border px-4 py-4 text-left transition ${
                targetMode === "OTHER" ? "border-[#800020] bg-[#800020] text-white" : "border-[#e7d7ac] bg-white text-[#4a0012] hover:border-[#c5a059]"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className="flex items-center gap-3 text-base font-semibold">
                <UsersRound className="h-7 w-7" />
                <span>Outra pessoa</span>
              </span>
              <span className={`mt-1 block text-xs ${targetMode === "OTHER" ? "text-[#f7e8c4]" : "text-slate-500"}`}>Use para solicitar acesso para um colaborador.</span>
            </button>
          </div>
          {targetMode === "OTHER" && canRequestForOther ? (
            <>
              <input
                className="mt-3 w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="Pesquisar pessoa por nome ou email"
                value={targetQuery}
                onChange={(event) => setTargetQuery(event.target.value)}
              />
              <select
                value={targetUserId}
                onChange={(event) => setTargetUserId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
              >
                {filteredTargetUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.label}
                  </option>
                ))}
              </select>
              {filteredTargetUsers.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nenhum usuario encontrado.</p> : null}
            </>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[#f1e6c9] bg-[#fff8e8] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modo</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setRequestType("SINGLE")}
              className={`rounded-xl border px-4 py-4 text-center transition ${
                requestType === "SINGLE" ? "border-[#800020] bg-[#800020] text-white" : "border-[#e7d7ac] bg-white text-[#4a0012] hover:border-[#c5a059]"
              }`}
            >
              <span className="mb-2 flex justify-center">
                <ShoppingBag className="h-14 w-14" />
              </span>
              <span className="flex items-center justify-center gap-2 text-sm font-semibold">
                <span>Acessos Adicionais</span>
              </span>
              <span className={`mt-1 block text-[11px] ${requestType === "SINGLE" ? "text-[#f7e8c4]" : "text-slate-500"}`}>Selecione roles especificas por sistema.</span>
            </button>
            <button
              type="button"
              onClick={() => setRequestType("MIRROR")}
              className={`rounded-xl border px-4 py-4 text-center transition ${
                requestType === "MIRROR" ? "border-[#800020] bg-[#800020] text-white" : "border-[#e7d7ac] bg-white text-[#4a0012] hover:border-[#c5a059]"
              }`}
            >
              <span className="mb-2 flex justify-center">
                <Copy className="h-14 w-14" />
              </span>
              <span className="flex items-center justify-center gap-2 text-sm font-semibold">
                <span>Espelhamento de Acessos</span>
              </span>
              <span className={`mt-1 block text-[11px] ${requestType === "MIRROR" ? "text-[#f7e8c4]" : "text-slate-500"}`}>Replica apenas acessos adicionais de outro usuario.</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#f1e6c9] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {requestType === "SINGLE" ? `${selectedPermissions.length} roles selecionadas` : "Espelhamento por usuario"}
          </p>
          <p className="text-xs text-slate-500">Voce pode combinar multiplos sistemas no mesmo envio.</p>
        </div>
      </div>

      {requestType === "SINGLE" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-1">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Prazo padrao para acessos adicionais: 6 meses.
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sistemas</p>
            <input
              value={systemQuery}
              onChange={(event) => setSystemQuery(event.target.value)}
              placeholder="Buscar sistema por nome"
              className="w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
            />
            {paginatedSystems.map((system) => {
              const Icon = resolveSystemIcon(system.name);
              const thumb = resolveSystemThumb(system.name);
              const selected = system.id === selectedSystem?.id;
              const selectedCount = system.permissions.filter((permission) => selectedPermissionIds.includes(permission.id)).length;
              return (
                <button
                  key={system.id}
                  type="button"
                  onClick={() => setSelectedSystemId(system.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${selected ? "border-[#800020] bg-[#fff8e8]" : "border-[#f1e6c9] bg-white hover:border-[#c5a059]"}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[#e7d7ac] bg-white">
                      <img src={thumb} alt={`${system.name} logo`} className="h-7 w-7 object-contain" />
                      <span className="pointer-events-none absolute bottom-0 right-0 rounded-tl-md bg-[#f8ecd1] p-0.5 text-[#800020]">
                        <Icon size={10} />
                      </span>
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{toFriendlyLabel(system.name, "Sem sistema")}</span>
                      <span className="block text-xs text-slate-500">{system.permissions.length} roles</span>
                    </span>
                  </span>
                  {selectedCount > 0 ? <span className="rounded-full bg-[#800020] px-2 py-0.5 text-xs font-semibold text-white">{selectedCount}</span> : null}
                </button>
              );
            })}
            {filteredSystems.length > SYSTEMS_PER_PAGE ? (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-[#f1e6c9] bg-white px-3 py-2 text-xs text-slate-600">
                <span>
                  Pagina {systemsPage} de {totalSystemsPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSystemsPage((prev) => Math.max(1, prev - 1))}
                    disabled={systemsPage === 1}
                    className="rounded-md border border-[#e7d7ac] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setSystemsPage((prev) => Math.min(totalSystemsPages, prev + 1))}
                    disabled={systemsPage === totalSystemsPages}
                    className="rounded-md border border-[#e7d7ac] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Proxima
                  </button>
                </div>
              </div>
            ) : null}
            {filteredSystems.length === 0 ? <p className="text-sm text-slate-500">Nenhum sistema encontrado.</p> : null}
          </div>

          <div className="rounded-2xl border border-[#f1e6c9] bg-white p-4 lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">System Roles</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-900">
              {selectedSystem ? (
                <img
                  src={resolveSystemThumb(selectedSystem.name)}
                  alt={`${selectedSystem.name} logo`}
                  className="h-5 w-5 rounded-md border border-[#e7d7ac] bg-white p-0.5"
                />
              ) : null}
              {toFriendlyLabel(selectedSystem?.name, "Sem sistema")}
            </p>
            <div className="mt-3 space-y-2">
              {(selectedSystem?.permissions || []).map((permission) => {
                const isSelected = selectedPermissionIds.includes(permission.id);
                return (
                  <button
                    key={permission.id}
                    type="button"
                    onClick={() => togglePermission(permission.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${isSelected ? "border-[#800020] bg-[#fff8e8]" : "border-[#f1e6c9] bg-white hover:border-[#c5a059]"}`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{toFriendlyLabel(permission.name, "Sem role")}</p>
                    <p className="text-xs text-slate-500">{permission.description || "Sem descricao"}</p>
                    <p className="mt-1 text-xs font-semibold text-[#800020]">{isSelected ? "Remover" : "Adicionar"}</p>
                  </button>
                );
              })}
              {(selectedSystem?.permissions || []).length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma role cadastrada para este sistema.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-[#f1e6c9] bg-white p-4 lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Carrinho de acessos</p>
            <div className="mt-3 space-y-2">
              {selectedPermissions.map((permission) => (
                <div key={permission.id} className="flex items-start justify-between rounded-xl border border-[#f1e6c9] bg-[#fff8e8] px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{toFriendlyLabel(permission.name, "Sem role")}</p>
                    <p className="flex items-center gap-1 text-xs text-slate-500">
                      <img
                        src={resolveSystemThumb(permission.systemName)}
                        alt={`${permission.systemName} logo`}
                        className="h-4 w-4 rounded-sm border border-[#e7d7ac] bg-white p-0.5"
                      />
                      {toFriendlyLabel(permission.systemName, "Sem sistema")}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-xs text-slate-600">Tempo:</label>
                      <select
                        value={String(accessDurationByPermissionId[permission.id] ?? 6)}
                        onChange={(event) => setPermissionDuration(permission.id, Number(event.target.value) as AccessDurationMonths)}
                        className="rounded-md border border-[#e7d7ac] bg-white px-2 py-1 text-xs text-slate-700"
                      >
                        {ACCESS_DURATION_OPTIONS.map((months) => (
                          <option key={months} value={months}>
                            {months} {months === 1 ? "mes" : "meses"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePermission(permission.id)}
                    className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-[#800020]"
                  >
                    Remover
                  </button>
                </div>
              ))}
              {selectedPermissions.length === 0 ? <p className="text-sm text-slate-500">Nenhuma role selecionada.</p> : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#f1e6c9] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Origem para espelhamento</p>
          <input
            className="mt-2 w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm text-slate-900"
            placeholder="Pesquisar pessoa por nome ou email"
            value={mirrorQuery}
            onChange={(event) => setMirrorQuery(event.target.value)}
          />
          <select
            className="mt-2 w-full rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm text-slate-900"
            value={mirrorFromUserId}
            onChange={(event) => setMirrorFromUserId(event.target.value)}
          >
            {filteredMirrorUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.label}
              </option>
            ))}
          </select>
          {filteredMirrorUsers.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nenhum usuario com acesso adicional disponivel para espelhamento.</p> : null}
          <div className="mt-3 rounded-xl border border-[#f1e6c9] bg-[#fff8e8] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SRs da origem</p>
            {mirrorLoading ? <p className="mt-2 text-sm text-slate-600">Carregando...</p> : null}
            {mirrorError ? <p className="mt-2 text-sm text-red-600">{mirrorError}</p> : null}
            {!mirrorLoading && !mirrorError ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {mirrorPermissions.map((item) => (
                  <li key={item.id}>
                    {toFriendlyLabel(item.systemName, "Sem sistema")} - {toFriendlyLabel(item.permissionName, "Sem role")}
                  </li>
                ))}
                {mirrorPermissions.length === 0 ? <li>Nenhum acesso adicional encontrado.</li> : null}
              </ul>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-slate-500">Somente acessos adicionais (DIRECT) serao espelhados, nunca os acessos de BR.</p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Justificativa</label>
        <Textarea
          rows={4}
          placeholder="Explique a necessidade de negocio para os acessos selecionados."
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          required
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex items-center justify-between rounded-2xl border border-[#f1e6c9] bg-[#fff8e8] p-3">
        <p className="text-sm text-slate-700">
          {requestType === "SINGLE" ? `${selectedPermissions.length} system roles prontas para enviar` : "Espelhamento configurado"}
        </p>
        <Button
          type="submit"
          disabled={loading || (requestType === "SINGLE" && selectedPermissions.length === 0)}
        >
          {loading ? "Enviando..." : "Enviar solicitacao"}
        </Button>
      </div>
    </form>
  );
}


