"use client";

import { useCallback, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { buttonClass } from "./button";

/*
  FilterBar — filters inline on desktop, in a bottom sheet on phones.

  • lg and up (desktop): your filter controls (`children`) sit in a row.
  • Phones & tablets: one "Filters" button (showing how many are active); tapping it
    opens a BottomSheet with the same controls stacked, plus Reset / Done.

  `search` stays visible on every screen size, since it's the filter
  people use most. The controls are rendered in both places but only one
  is ever shown, and they share the parent's state, so they stay in sync.
*/
export default function FilterBar({
  children,
  search,
  activeCount = 0,
  onReset,
  title = "Filters",
  className = "",
}: {
  children: React.ReactNode;
  search?: React.ReactNode;
  activeCount?: number;
  onReset?: () => void;
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className={`flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center ${className}`}>
      <div className="flex min-w-0 items-center gap-2 lg:contents">
          {search && <div className="min-w-0 flex-1 lg:max-w-sm">{search}</div>}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={`${buttonClass("secondary")} lg:hidden ${search ? "" : "w-full"}`}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {title}
            {activeCount > 0 && (
              <span className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-navy px-1 text-label-sm text-on-navy">
                {activeCount}
                <span className="sr-only"> active</span>
              </span>
            )}
          </button>
        </div>

      {/* Desktop: inline */}
      <div className="hidden min-w-0 flex-wrap items-center gap-2 lg:flex">{children}</div>

      {/* Phones: sheet */}
      <BottomSheet
        open={open}
        onClose={close}
        title={title}
        footer={
          <>
            {onReset && (
              <button type="button" onClick={onReset} className={`${buttonClass("secondary")} flex-1`}>
                Reset
              </button>
            )}
            <button type="button" onClick={close} className={`${buttonClass("navy")} flex-1`}>
              Show results
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4 [&_select]:w-full [&>*]:w-full">{children}</div>
      </BottomSheet>
    </div>
  );
}
