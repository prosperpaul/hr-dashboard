/*
  Sample (fake) HR data used to design the dashboard.
  Later this will be replaced by real data from the database —
  the components that use it won't need to change.
*/

// ---- Top stat cards ----------------------------------------------------
export type Stat = {
  key: string;
  label: string;
  value: string;      // pre-formatted for display, e.g. "248" or "3.2%"
  deltaPct: number;   // change vs last period; positive = went up
  upIsGood: boolean;  // does an INCREASE mean improvement? (turnover: no)
  spark: number[];    // tiny trend line shown inside the card
};

export const stats: Stat[] = [
  {
    key: "employees",
    label: "Total Employees",
    value: "248",
    deltaPct: 4.2,
    upIsGood: true,
    spark: [210, 214, 220, 223, 230, 236, 241, 248],
  },
  {
    key: "hires",
    label: "New Hires (30d)",
    value: "12",
    deltaPct: 20,
    upIsGood: true,
    spark: [4, 6, 5, 7, 8, 9, 10, 12],
  },
  {
    key: "leave",
    label: "On Leave Today",
    value: "8",
    deltaPct: -12.5,
    upIsGood: false, // more people on leave is not good
    spark: [12, 11, 13, 10, 9, 10, 9, 8],
  },
  {
    key: "turnover",
    label: "Turnover Rate",
    value: "3.2%",
    deltaPct: 0.4,
    upIsGood: false, // turnover going up is bad
    spark: [2.6, 2.7, 2.9, 2.8, 3.0, 3.1, 3.0, 3.2],
  },
];

// ---- Headcount over the last 12 months ---------------------------------
export type HeadcountPoint = { month: string; headcount: number };

export const headcount: HeadcountPoint[] = [
  { month: "Aug", headcount: 198 },
  { month: "Sep", headcount: 205 },
  { month: "Oct", headcount: 212 },
  { month: "Nov", headcount: 218 },
  { month: "Dec", headcount: 221 },
  { month: "Jan", headcount: 226 },
  { month: "Feb", headcount: 230 },
  { month: "Mar", headcount: 235 },
  { month: "Apr", headcount: 238 },
  { month: "May", headcount: 242 },
  { month: "Jun", headcount: 245 },
  { month: "Jul", headcount: 248 },
];

// ---- Employees per department ------------------------------------------
export type DeptPoint = { department: string; employees: number };

export const departments: DeptPoint[] = [
  { department: "Engineering", employees: 84 },
  { department: "Sales", employees: 52 },
  { department: "Support", employees: 34 },
  { department: "Marketing", employees: 30 },
  { department: "Finance", employees: 18 },
  { department: "Design", employees: 16 },
  { department: "People", employees: 14 },
];

// ---- Recent hires list -------------------------------------------------
export type Hire = {
  name: string;
  role: string;
  department: string;
  startedAt: string; // human-readable for now
  initials: string;
};

export const recentHires: Hire[] = [
  { name: "Amara Okafor", role: "Frontend Engineer", department: "Engineering", startedAt: "2 days ago", initials: "AO" },
  { name: "Daniel Reyes", role: "Account Executive", department: "Sales", startedAt: "4 days ago", initials: "DR" },
  { name: "Priya Nair", role: "Product Designer", department: "Design", startedAt: "1 week ago", initials: "PN" },
  { name: "Marcus Lee", role: "Support Specialist", department: "Support", startedAt: "1 week ago", initials: "ML" },
  { name: "Sofia Rossi", role: "Financial Analyst", department: "Finance", startedAt: "2 weeks ago", initials: "SR" },
];

// ---- Full employee directory -------------------------------------------

// The statuses an employee can have. `as const` freezes this list so
// TypeScript treats each value as an exact option, not just "a string".
export const employeeStatuses = ["Active", "On Leave", "Remote"] as const;
export type EmployeeStatus = (typeof employeeStatuses)[number];

// The departments an employee can belong to (reused by the form dropdown).
export const departmentNames = [
  "Engineering",
  "Sales",
  "Support",
  "Marketing",
  "Finance",
  "Design",
  "People",
] as const;

// The Employee shape used across the UI. `departmentId` is the real foreign
// key; `department` is the resolved NAME, carried alongside for easy display.
export type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
  department: string; // department name, or "" / "Unassigned" if none
  status: EmployeeStatus;
  startedAt: string; // ISO date, e.g. "2023-05-14"
  leaveAllowance: number; // annual paid-leave entitlement in days
};

// The shape of the hard-coded sample rows below — used only for seeding, where
// the department is given by NAME (the seed connects it to the real record).
type SeedEmployee = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: EmployeeStatus;
  startedAt: string;
};

// Turn a full name into initials, e.g. "Amara Okafor" -> "AO".
export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export const employees: SeedEmployee[] = [
  { id: "e1", name: "Amara Okafor", email: "amara.okafor@company.com", role: "Frontend Engineer", department: "Engineering", status: "Active", startedAt: "2024-11-04" },
  { id: "e2", name: "Daniel Reyes", email: "daniel.reyes@company.com", role: "Account Executive", department: "Sales", status: "Active", startedAt: "2024-10-21" },
  { id: "e3", name: "Priya Nair", email: "priya.nair@company.com", role: "Product Designer", department: "Design", status: "Remote", startedAt: "2024-09-30" },
  { id: "e4", name: "Marcus Lee", email: "marcus.lee@company.com", role: "Support Specialist", department: "Support", status: "Active", startedAt: "2024-09-12" },
  { id: "e5", name: "Sofia Rossi", email: "sofia.rossi@company.com", role: "Financial Analyst", department: "Finance", status: "On Leave", startedAt: "2024-08-25" },
  { id: "e6", name: "James Carter", email: "james.carter@company.com", role: "Engineering Manager", department: "Engineering", status: "Active", startedAt: "2023-05-14" },
  { id: "e7", name: "Lin Wei", email: "lin.wei@company.com", role: "Backend Engineer", department: "Engineering", status: "Remote", startedAt: "2023-07-02" },
  { id: "e8", name: "Fatima Hassan", email: "fatima.hassan@company.com", role: "HR Generalist", department: "People", status: "Active", startedAt: "2023-02-18" },
  { id: "e9", name: "Oliver Grant", email: "oliver.grant@company.com", role: "Sales Manager", department: "Sales", status: "Active", startedAt: "2022-11-09" },
  { id: "e10", name: "Chloe Bennett", email: "chloe.bennett@company.com", role: "Marketing Lead", department: "Marketing", status: "Active", startedAt: "2023-01-23" },
  { id: "e11", name: "Diego Martinez", email: "diego.martinez@company.com", role: "Support Specialist", department: "Support", status: "On Leave", startedAt: "2024-03-11" },
  { id: "e12", name: "Hana Kim", email: "hana.kim@company.com", role: "UX Researcher", department: "Design", status: "Remote", startedAt: "2024-02-05" },
  { id: "e13", name: "Noah Williams", email: "noah.williams@company.com", role: "DevOps Engineer", department: "Engineering", status: "Active", startedAt: "2023-09-19" },
  { id: "e14", name: "Aisha Bello", email: "aisha.bello@company.com", role: "Recruiter", department: "People", status: "Active", startedAt: "2024-06-01" },
  { id: "e15", name: "Ethan Brooks", email: "ethan.brooks@company.com", role: "Accountant", department: "Finance", status: "Active", startedAt: "2023-12-14" },
  { id: "e16", name: "Mia Zhang", email: "mia.zhang@company.com", role: "Content Strategist", department: "Marketing", status: "Remote", startedAt: "2024-04-27" },
];
