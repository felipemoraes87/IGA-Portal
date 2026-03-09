import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock3, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { resolveSystemThumb } from "@/lib/system-logo";
import { formatDate, toFriendlyLabel } from "@/lib/utils";

function statusBadge(status: string) {
  if (status === "PENDING_APPROVAL") {
    return (
      <span className="vision-status vision-status-pending">
        <span className="vision-status-dot bg-amber-500" />
        Aguardando
      </span>
    );
  }
  if (status === "RUNNING") {
    return (
      <span className="vision-status vision-status-running">
        <span className="vision-status-dot bg-[#008080]" />
        Em execucao
      </span>
    );
  }
  if (status === "APPROVED" || status === "EXECUTED") {
    return (
      <span className="vision-status vision-status-done">
        <span className="vision-status-dot bg-emerald-500" />
        Concluido
      </span>
    );
  }
  return (
    <span className="vision-status vision-status-failed">
      <span className="vision-status-dot bg-red-500" />
      Falha
    </span>
  );
}

export default async function HomePage() {
  const user = await requirePageUser("USER");
  const canManage = user.role === "MANAGER" || user.role === "ADMIN";
  const isAdmin = user.role === "ADMIN";

  const [pendingApproval, running, completed, failed, latestRequests] = await Promise.all([
    db.accessRequest.count({
      where:
        user.role === "ADMIN"
          ? { status: "PENDING_APPROVAL" }
          : user.role === "MANAGER"
            ? { status: "PENDING_APPROVAL", approverId: user.id }
            : { status: "PENDING_APPROVAL", requesterId: user.id },
    }),
    db.accessRequest.count({
      where: user.role === "ADMIN" ? { status: "RUNNING" } : { status: "RUNNING", requesterId: user.id },
    }),
    db.accessRequest.count({
      where: user.role === "ADMIN" ? { status: "APPROVED" } : { status: "APPROVED", requesterId: user.id },
    }),
    db.accessRequest.count({
      where: user.role === "ADMIN" ? { status: "FAILED" } : { status: "FAILED", requesterId: user.id },
    }),
    db.accessRequest.findMany({
      where: user.role === "ADMIN" ? {} : { requesterId: user.id },
      include: { permission: { include: { system: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  return (
    <AppShell
      user={user}
      title="Dashboard Overview"
      description={`Bem-vindo de volta, ${user.name.split(" ")[0]}. Aqui esta o resumo das atividades de acesso.`}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pendentes de aprovacao" value={pendingApproval} icon={<Clock3 className="h-5 w-5" />} tone="amber" />
        <MetricCard label="Em execucao" value={running} icon={<RefreshCcw className="h-5 w-5" />} tone="teal" />
        <MetricCard label="Concluidas" value={completed} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <MetricCard label="Falhas recentes" value={failed} icon={<AlertCircle className="h-5 w-5" />} tone="red" />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card className="border-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Minhas ultimas solicitacoes</h3>
              <Link href="/my-requests" className="text-sm font-semibold text-[#800020] hover:underline">
                Ver todas
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-compact">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Sistema</th>
                    <th>Role / Perfil</th>
                    <th>Status</th>
                    <th className="text-right">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {latestRequests.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 text-slate-800 transition hover:bg-slate-50/70">
                      <td className="font-semibold text-[#800020]">#{item.id.slice(0, 8)}</td>
                      <td className="font-medium">
                        <span className="flex items-center gap-2">
                          <img src={resolveSystemThumb(item.permission.system.name)} alt={`${item.permission.system.name} logo`} className="h-4 w-4 rounded-sm border border-[#e7d7ac] bg-white p-0.5" />
                          {toFriendlyLabel(item.permission.system.name, "Sem sistema")}
                        </span>
                      </td>
                      <td>{toFriendlyLabel(item.permission.name, "Sem role")}</td>
                      <td>{statusBadge(item.status)}</td>
                      <td className="text-right text-slate-500">{formatDate(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {latestRequests.length === 0 ? <p className="px-3 py-6 text-sm text-slate-500">Sem solicitacoes recentes.</p> : null}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-slate-200">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-slate-500">Acoes rapidas</h3>
            <div className="space-y-2">
              <QuickAction href="/request/new" label="Nova solicitacao" icon={<Sparkles className="h-4 w-4" />} />
              <QuickAction href="/my-access" label="Meus acessos" icon={<ShieldCheck className="h-4 w-4" />} />
              <QuickAction href="/my-requests" label="Acompanhar solicitacoes" icon={<RefreshCcw className="h-4 w-4" />} />
              {canManage ? <QuickAction href="/manager/approvals" label="Aprovacoes pendentes" icon={<CheckCircle2 className="h-4 w-4" />} /> : null}
              {isAdmin ? <QuickAction href="/admin" label="Dashboard admin" icon={<ShieldCheck className="h-4 w-4" />} /> : null}
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone,
}: Readonly<{ label: string; value: number; icon: ReactNode; tone: "amber" | "teal" | "emerald" | "red" }>) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : tone === "teal"
        ? "bg-teal-100 text-teal-700"
        : tone === "emerald"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-700";
  return (
    <Card className="border-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}>{icon}</div>
      </div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
    </Card>
  );
}

function QuickAction({ href, label, icon }: Readonly<{ href: string; label: string; icon: ReactNode }>) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-[#d4af37] hover:bg-[#fff8e8] hover:text-[#800020]"
    >
      <span className="flex items-center gap-2">
        <span className="text-[#800020]">{icon}</span>
        {label}
      </span>
      <span className="text-xs text-slate-400">Abrir</span>
    </Link>
  );
}
