import Link from "next/link";

/*
  Fab ("floating action button") — the page's main action as a butter-yellow
  pill that floats bottom-right, just above the phone tab bar, where a thumb
  naturally rests ("Add employee", "Request leave", "Post a job").

  Phones & tablets only (lg:hidden) — on desktop the same action already sits
  in the page header. Pass `href` for a link or `onClick` for a button (the
  latter needs a Client Component parent).
*/
export default function Fab({
  label,
  icon,
  href,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const cls =
    "fixed right-gutter bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+1rem)] z-30 inline-flex min-h-14 items-center gap-2 rounded-full bg-accent pl-5 pr-6 text-label-md font-semibold text-on-accent shadow-[0_0_0_1px_rgb(16_27_58/0.08)] transition-colors hover:bg-accent-hover active:bg-accent-pressed lg:hidden";
  const body = (
    <>
      <span aria-hidden className="grid size-5 place-items-center">
        {icon}
      </span>
      {label}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}
