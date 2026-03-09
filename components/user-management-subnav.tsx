import Link from "next/link";
import { Card } from "@/components/ui/card";

type UserManagementKey = "users" | "scim";

const links: Array<{ key: UserManagementKey; href: string; label: string }> = [
  { key: "users", href: "/admin/user-management", label: "Users" },
  { key: "scim", href: "/admin/scim", label: "SCIM" },
];

export function UserManagementSubnav({ active }: Readonly<{ active: UserManagementKey }>) {
  return (
    <Card className="p-3">
      <nav className="grid grid-cols-2 gap-2">
        {links.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold transition ${
              item.key === active ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </Card>
  );
}
