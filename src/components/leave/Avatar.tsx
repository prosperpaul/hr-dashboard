import { initialsOf } from "@/lib/sample-data";
import { deptTint } from "@/lib/dept-tint";

/*
  A round initials avatar, tinted with the person's department colour
  (we don't store photos, so initials stand in for them).
  `size` is the diameter in pixels.
*/
export default function Avatar({ name, department, size = 32 }: { name: string; department: string | null; size?: number }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-bold text-ink ${deptTint(department)}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.34)) }}
    >
      {initialsOf(name)}
    </span>
  );
}
