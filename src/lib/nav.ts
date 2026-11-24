import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  Clock,
  UserPlus,
  TrendingUp,
  Wallet,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/*
  ONE place that lists every page in the app. Both navigations read it:
  • the desktop sidebar (lg and up) shows every section;
  • the phone bottom tab bar shows the items marked `tab`, and everything
    else goes into its "More" sheet.
  So adding a page here makes it appear in both automatically.

  Each item has: a label, the URL, an icon, and optional flags:
  `adminOnly` hides it from non-Admins, `soon` marks unbuilt features,
  `tab` + `tabLabel` put it on the phone tab bar (with a shorter name).
*/
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  soon?: boolean;
  adminOnly?: boolean;
  tab?: boolean;
  tabLabel?: string;
};

export type NavSection = {
  heading: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    heading: "Main",
    items: [
      { label: "Overview", href: "/", icon: LayoutDashboard, tab: true, tabLabel: "Home" },
      { label: "Employees", href: "/employees", icon: Users, tab: true, tabLabel: "People" },
      { label: "Departments", href: "/departments", icon: Building2 },
    ],
  },
  {
    heading: "Operations",
    items: [
      { label: "Leave", href: "/leave", icon: CalendarDays, tab: true },
      { label: "Attendance", href: "/attendance", icon: Clock },
      { label: "Recruitment", href: "/recruitment", icon: UserPlus },
      { label: "Performance", href: "/performance", icon: TrendingUp },
      { label: "Payroll", href: "/payroll", icon: Wallet },
    ],
  },
  {
    heading: "System",
    items: [
      { label: "User accounts", href: "/users", icon: ShieldCheck, adminOnly: true },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** The sections a given role may see (admin-only links removed, empty sections dropped). */
export function visibleSections(role?: string | null): NavSection[] {
  return navSections
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.adminOnly || role === "Admin") }))
    .filter((s) => s.items.length > 0);
}

/** Items pinned to the phone tab bar, in order. */
export const tabItems: NavItem[] = navSections.flatMap((s) => s.items).filter((i) => i.tab);

/**
 * Is this link the page you're on? "/" must match exactly; every other link
 * also counts for its sub-pages, so /employees/abc keeps "People" lit.
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
