"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type IconName =
  | "home"
  | "access"
  | "requests"
  | "new-request"
  | "team"
  | "approvals"
  | "admin"
  | "system-roles"
  | "assignment"
  | "user-management"
  | "my-systems"
  | "my-srs"
  | "my-brs";
type LinkSection = "personal" | "owner" | "management";
type ShellNavLink = { href: string; label: string; icon: IconName; section: LinkSection };
type ShellUser = { name: string; email: string; role: string };
type SearchResultItem = {
  id: string;
  type: "USER" | "BR" | "SYSTEM" | "SR";
  label: string;
  subLabel: string;
  href: string;
};

type AppShellClientProps = Readonly<{
  user: ShellUser;
  title: string;
  description?: string;
  links: ShellNavLink[];
  alerts: Array<{
    id: string;
    title: string;
    description: string;
    tone: "critical" | "warning" | "info";
    href?: string;
  }>;
  children: React.ReactNode;
}>;

const icons: Record<IconName, React.ComponentType<{ className?: string }>> = {
  home: Home,
  access: KeyRound,
  requests: ClipboardList,
  "new-request": CheckCircle2,
  team: Users,
  approvals: ShieldCheck,
  admin: LayoutDashboard,
  "user-management": Users,
  "system-roles": KeyRound,
  assignment: ClipboardList,
  "my-systems": LayoutDashboard,
  "my-srs": KeyRound,
  "my-brs": ClipboardList,
};
const LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAVqXUvQT7ar2Jj0jBsO8Ugewggd83EXmnPgCO3xNKasjTYNZLq6k1NR_8mqMGA03SotnknB85UxumjYynmwXR18B8BbdrBIDC6Au2tMzMZ3I01tTOWlCp1isNpd_5iNEat6Z5CD6pJlb5OpOSbn0mYDQ_rWauLjgFKKsrG4UJ4Hm6EJnBkZf7v1X7phZCBYpt1hntYeJ4XXfDHro9M2HPpftmO6ZuMEBPEr4nKeEgaNb6L1Z6H5ghz4JRk0TsqpVOT8453JhASeC4";
const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCIYzIrz2Z3CkBD88oRgtv2qgK6qJYwZ28o4_x4A3u_BYayCL62mLc53ZeP318vD4CZBbTO_Tu7apPw32VSMjsujPU7k2wZtPIi_cUs5cqI9WqPKW0098AzXVMw2gXZMmnx0WTvS_QiFOtU3zg7uFC8RJeSDfmv6Yz72PMTRwOw69iGa0u9pxKm6NzoNdQYGyOQxZ3WKeXtC2DlMyh8VEIS4iHbO15BoIaiA779ApD4_gZ_miPXsVvctaoeEGpTYtmLIcvBa4D5qV0";

function isLinkActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href);
}

function splitLinks(links: ShellNavLink[]) {
  const personal = links.filter((item) => item.section === "personal");
  const owner = links.filter((item) => item.section === "owner");
  const management = links.filter((item) => item.section === "management");
  return { personal, owner, management };
}

type NavItemProps = Readonly<{
  link: ShellNavLink;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}>;

function NavItem({ link, pathname, collapsed, onNavigate }: NavItemProps) {
  const Icon = icons[link.icon];
  const active = isLinkActive(pathname, link.href);
  return (
    <Link
      key={link.href}
      href={link.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
        active ? "bg-[#800020] text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        collapsed && "justify-center",
      )}
      title={collapsed ? link.label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn(collapsed && "hidden")}>{link.label}</span>
    </Link>
  );
}

export function AppShellClient({ user, title, description, links, alerts, children }: AppShellClientProps) { // NOSONAR
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [alertsSeenCount, setAlertsSeenCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const alertsContainerRef = useRef<HTMLDivElement | null>(null);
  const settingsContainerRef = useRef<HTMLDivElement | null>(null);

  const { personal: personalLinks, owner: ownerLinks, management: managementLinks } = useMemo(() => splitLinks(links), [links]);
  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let active = true;
    const handle = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/search/global?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const payload = (await response.json()) as { data?: SearchResultItem[] };
        if (!active) return;
        setSearchResults(payload.data || []);
      } catch {
        if (!active) return;
        setSearchResults([]);
      } finally {
        if (active) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [searchQuery]);

  useEffect(() => {
    const compactSaved = window.localStorage.getItem("iga_pref_compact_mode") === "true";
    const reducedSaved = window.localStorage.getItem("iga_pref_reduced_motion") === "true";
    const seenCountSaved = Number(window.localStorage.getItem("iga_alerts_seen_count") || "0");
    setCompactMode(compactSaved);
    setReducedMotion(reducedSaved);
    setAlertsSeenCount(Number.isFinite(seenCountSaved) ? seenCountSaved : 0);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("pref-compact", compactMode);
    window.localStorage.setItem("iga_pref_compact_mode", compactMode ? "true" : "false");
  }, [compactMode]);

  useEffect(() => {
    document.documentElement.classList.toggle("pref-reduce-motion", reducedMotion);
    window.localStorage.setItem("iga_pref_reduced_motion", reducedMotion ? "true" : "false");
  }, [reducedMotion]);

  useEffect(() => {
    function onDocumentPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setSearchOpen(false);
      }
      if (alertsContainerRef.current && !alertsContainerRef.current.contains(target)) {
        setAlertsOpen(false);
      }
      if (settingsContainerRef.current && !settingsContainerRef.current.contains(target)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocumentPointerDown);
    return () => document.removeEventListener("mousedown", onDocumentPointerDown);
  }, []);

  const hasSearchText = searchQuery.trim().length >= 2;
  const showSearchDropdown = searchOpen && (hasSearchText || searchLoading);
  const hasUnreadAlerts = alerts.length > alertsSeenCount;

  const quickLinks = [
    { href: "/my-access", label: "Meus Acessos" },
    { href: "/my-requests", label: "Minhas Solicitacoes" },
    ...(user.role === "MANAGER" || user.role === "ADMIN" ? [{ href: "/manager/approvals", label: "Aprovacoes" }] : []),
  ];

  const adminQuickLinks =
    user.role === "ADMIN"
      ? [
          { href: "/admin/logs", label: "Logs do Portal" },
          { href: "/admin/scim", label: "SCIM Settings" },
          { href: "/admin/operation", label: "Operacoes IAM" },
        ]
      : [];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7f8] text-slate-900">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm md:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => setMobileOpen(false)}
        className={cn("fixed inset-0 z-30 bg-slate-950/40 md:hidden", !mobileOpen && "hidden")}
        aria-label="Fechar menu"
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 md:static",
          collapsed ? "w-20" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
            <img src={LOGO_URL} alt="Vision IGA" className="h-full w-full object-contain" />
          </div>
          <div className={cn("min-w-0", collapsed && "hidden")}>
            <p className="truncate text-base font-bold text-slate-900">Vision IGA</p>
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-[#d4af37]">Enterprise Premium</p>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((state) => !state)}
            className="ml-auto hidden h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:inline-flex"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <div className={cn("pb-1", collapsed && "hidden", personalLinks.length === 0 && "hidden")}>
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Pessoal</p>
          </div>
          {personalLinks.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} collapsed={collapsed} onNavigate={closeMobile} />
          ))}

          <div className={cn("pt-3 pb-1", collapsed && "hidden", ownerLinks.length === 0 && "hidden")}>
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Ownership</p>
          </div>
          {ownerLinks.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} collapsed={collapsed} onNavigate={closeMobile} />
          ))}

          <div className={cn("pt-3 pb-1", collapsed && "hidden", managementLinks.length === 0 && "hidden")}>
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Management</p>
          </div>
          {managementLinks.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} collapsed={collapsed} onNavigate={closeMobile} />
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className={cn("rounded-xl border border-slate-200 bg-slate-50 p-3", collapsed && "px-2")}>
            <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
              <div className="h-7 w-7 overflow-hidden rounded-lg bg-[#800020]/10">
                <img src={AVATAR_URL} alt="User" className="h-full w-full object-cover" />
              </div>
              <div className={cn("min-w-0", collapsed && "hidden")}>
                <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.role}</p>
              </div>
            </div>
            <p className={cn("mt-1 truncate text-xs text-slate-500", collapsed && "hidden")}>{user.email}</p>
          </div>
          <form action="/api/auth/logout" method="post" className="mt-2">
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900",
                collapsed && "justify-center",
              )}
              title={collapsed ? "Sair" : undefined}
            >
              <LogOut className="h-4 w-4" />
              <span className={cn(collapsed && "hidden")}>Sair</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8">
          <p className="text-sm font-medium text-slate-500">Home</p>
          <div className="flex items-center gap-3 md:gap-6">
            <div ref={searchContainerRef} className="relative hidden w-72 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por sistemas, acessos ou usuarios..."
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSearchOpen(false);
                    return;
                  }
                  if (event.key === "Enter" && searchResults.length > 0) {
                    event.preventDefault();
                    setSearchOpen(false);
                    router.push(searchResults[0].href);
                  }
                }}
                className="w-full rounded-lg border-none bg-slate-100 py-2 pl-9 pr-4 text-sm text-slate-700 outline-none ring-2 ring-transparent transition focus:ring-[#800020]/15"
              />
              {showSearchDropdown ? (
                <Card className="absolute left-0 top-11 z-50 w-full border-slate-200 p-0 shadow-lg">
                  <div className="max-h-[420px] overflow-y-auto">
                    {searchLoading ? <p className="px-3 py-3 text-sm text-slate-500">Buscando...</p> : null}
                    {!searchLoading && searchResults.length === 0 ? <p className="px-3 py-3 text-sm text-slate-500">Nenhum resultado encontrado.</p> : null}
                    {!searchLoading
                      ? searchResults.map((item) => (
                          <Link
                            key={`${item.type}-${item.id}`}
                            href={item.href}
                            onClick={() => setSearchOpen(false)}
                            className="block border-b border-slate-100 px-3 py-2 hover:bg-slate-50 last:border-b-0"
                          >
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">{item.type}</span>
                              <p className="truncate text-sm font-semibold text-slate-900">{item.label}</p>
                            </div>
                            <p className="truncate text-xs text-slate-500">{item.subLabel}</p>
                          </Link>
                        ))
                      : null}
                  </div>
                </Card>
              ) : null}
            </div>
            <div ref={alertsContainerRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  const next = !alertsOpen;
                  setAlertsOpen(next);
                  setSettingsOpen(false);
                  if (next) {
                    setAlertsSeenCount(alerts.length);
                    window.localStorage.setItem("iga_alerts_seen_count", String(alerts.length));
                  }
                }}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                aria-label="Alertas"
              >
                <Bell className="h-4 w-4" />
                {hasUnreadAlerts ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" /> : null}
              </button>
              {alertsOpen ? (
                <Card className="absolute right-0 top-11 z-50 w-[380px] border-slate-200 p-0 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800">Alertas</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{alerts.length}</span>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto">
                    {alerts.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-slate-500">Sem alertas no momento.</p>
                    ) : (
                      alerts.map((alert) => {
                        const toneClasses =
                          alert.tone === "critical"
                            ? "border-l-red-500 bg-red-50"
                            : alert.tone === "warning"
                              ? "border-l-amber-500 bg-amber-50"
                              : "border-l-blue-500 bg-blue-50";
                        const Icon = alert.tone === "critical" ? AlertCircle : alert.tone === "warning" ? AlertTriangle : Bell;
                        const content = (
                          <div className={`border-l-4 px-3 py-2 ${toneClasses}`}>
                            <div className="flex items-start gap-2">
                              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                                <p className="text-xs text-slate-600">{alert.description}</p>
                              </div>
                            </div>
                          </div>
                        );
                        return alert.href ? (
                          <Link
                            key={alert.id}
                            href={alert.href}
                            className="block border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                            onClick={() => setAlertsOpen(false)}
                          >
                            {content}
                          </Link>
                        ) : (
                          <div key={alert.id} className="border-b border-slate-100 last:border-b-0">
                            {content}
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              ) : null}
            </div>
            <div ref={settingsContainerRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen((prev) => !prev);
                  setAlertsOpen(false);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                aria-label="Configuracoes"
              >
                <Settings className="h-4 w-4" />
              </button>
              {settingsOpen ? (
                <Card className="absolute right-0 top-11 z-50 w-[340px] border-slate-200 p-0 shadow-lg">
                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800">Configuracoes rapidas</p>
                    <p className="text-xs text-slate-500">{user.name} ({user.role})</p>
                  </div>

                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Acoes</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAlertsOpen(true);
                          setSettingsOpen(false);
                          setAlertsSeenCount(alerts.length);
                          window.localStorage.setItem("iga_alerts_seen_count", String(alerts.length));
                        }}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Abrir alertas
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAlertsSeenCount(alerts.length);
                          window.localStorage.setItem("iga_alerts_seen_count", String(alerts.length));
                        }}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Marcar alertas como vistos
                      </button>
                    </div>
                  </div>

                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Preferencias</p>
                    <label className="flex items-center justify-between py-1 text-sm text-slate-700">
                      <span>Modo compacto</span>
                      <input type="checkbox" checked={compactMode} onChange={(event) => setCompactMode(event.target.checked)} />
                    </label>
                    <label className="flex items-center justify-between py-1 text-sm text-slate-700">
                      <span>Reduzir animacoes</span>
                      <input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} />
                    </label>
                  </div>

                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Atalhos</p>
                    <div className="space-y-1">
                      {quickLinks.map((item) => (
                        <Link key={item.href} href={item.href} onClick={() => setSettingsOpen(false)} className="block text-sm text-[#800020] hover:underline">
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>

                  {adminQuickLinks.length > 0 ? (
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Admin</p>
                      <div className="space-y-1">
                        {adminQuickLinks.map((item) => (
                          <Link key={item.href} href={item.href} onClick={() => setSettingsOpen(false)} className="block text-sm text-[#800020] hover:underline">
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="px-3 py-2">
                    <form action="/api/auth/logout" method="post">
                      <button className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                        Sair
                      </button>
                    </form>
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto w-full max-w-[1200px] space-y-6">
            <Card className="border-slate-200 bg-gradient-to-r from-[#800020] to-[#d4af37] text-white">
              <h2 className="text-2xl font-bold">{title}</h2>
              {description ? <p className="mt-1 text-sm text-[#f7e8c4]">{description}</p> : null}
            </Card>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
