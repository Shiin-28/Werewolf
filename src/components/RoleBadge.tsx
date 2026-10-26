import { ROLES } from "@/lib/roles";
import type { RoleId } from "@/lib/types";

/** Small role chip (icon + name) for lists. */
export function RoleBadge({ role }: { role: RoleId }) {
  const info = ROLES[role];
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-sm ${info.card}`}>
      <Icon className="size-4" aria-hidden />
      <span className="font-display uppercase tracking-wider">{info.name}</span>
      <span className="font-jp text-xs opacity-80">{info.ja}</span>
    </span>
  );
}
