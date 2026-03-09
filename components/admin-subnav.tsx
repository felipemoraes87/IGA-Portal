import Link from "next/link";
import { Card } from "@/components/ui/card";

type AdminKey = "home" | "operation" | "uar" | "systems" | "business-roles" | "users" | "requests" | "system-roles" | "assignment";

const links: Array<{ key: AdminKey; href: string; label: string }> = [
  { key: "operation", href: "/admin/operation", label: "Operacao" },
  { key: "uar", href: "/admin/uar", label: "UAR" },
  { key: "systems", href: "/admin/systems", label: "Systems" },
  { key: "business-roles", href: "/admin/business-roles", label: "Business Roles" },
  { key: "users", href: "/admin/users", label: "Users" },
  { key: "requests", href: "/admin/requests", label: "Requests" },
  { key: "system-roles", href: "/admin/system-roles", label: "System Roles" },
  { key: "assignment", href: "/admin/assignment", label: "Assignment" },
];

export function AdminSubnav({ active }: Readonly<{ active: AdminKey }>) {
  return (
    <Card className="p-3">
      <nav className="flex w-full flex-wrap gap-2">
        {links.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold transition ${
              item.key === active ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            } min-w-[120px] flex-1`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </Card>
  );
}

