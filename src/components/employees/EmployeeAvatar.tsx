import { initialsOf } from "@/lib/sample-data";
import { deptTint } from "@/lib/dept-tint";

/*
  An employee's initials in a circle, tinted by their department.
  We don't store photos, so this stands in for the mockup's headshots.
  No "use client" here, so both server pages and client components can use it.
*/
const SIZES = {
  sm: "h-10 w-10 rounded-full text-label-md",
  lg: "h-20 w-20 rounded-full text-headline-md",
  xl: "h-24 w-24 rounded-xl text-headline-lg md:h-28 md:w-28",
} as const;

export default function EmployeeAvatar({ name, department, size = "sm" }: { name: string; department: string | null; size?: keyof typeof SIZES }) {
  return (
    <div className={`grid shrink-0 place-items-center font-display font-semibold text-ink ring-1 ring-inset ring-ink/10 ${SIZES[size]} ${deptTint(department)}`}>
      {initialsOf(name)}
    </div>
  );
}
