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
  Each menu item has: a label, the URL it links to, an icon,
  and an optional "soon" flag for features we'll build in later phases.
  `adminOnly` items are hidden from the sidebar unless the user is an Admin.
  Grouped into sections so the sidebar can show headings.
*/
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  soon?: boolean;
  adminOnly?: boolean;
};

export type NavSection = {
  heading: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    heading: "Main",
    items: [
      { label: "Overview", href: "/", icon: LayoutDashboard },
      { label: "Employees", href: "/employees", icon: Users },
      { label: "Departments", href: "/departments", icon: Building2 },
    ],
  },
  {
    heading: "Operations",
    items: [
      { label: "Leave", href: "/leave", icon: CalendarDays },
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
