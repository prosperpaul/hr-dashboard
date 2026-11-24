"use client";

import { useState } from "react";
import BottomSheet from "@/components/ui/BottomSheet";
import { buttonClass } from "@/components/ui/button";

// A "are you sure?" question waiting for an answer.
export type Confirmation = { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void };

/*
  The "are you sure?" step, as a bottom sheet on phones / small dialog on
  desktop (replaces the browser's plain confirm() box). We keep the last
  question on screen while the sheet slides away, so the text doesn't vanish mid-animation.
*/
export default function ConfirmSheet({ confirmation, onClose }: { confirmation: Confirmation | null; onClose: () => void }) {
  const [last, setLast] = useState(confirmation);
  if (confirmation && confirmation !== last) setLast(confirmation);
  const c = confirmation ?? last;
  return (
    <BottomSheet
      open={confirmation !== null}
      onClose={onClose}
      title={c?.title ?? ""}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${buttonClass("secondary")} flex-1 md:flex-none`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              c?.onConfirm();
              onClose();
            }}
            className={`${buttonClass(c?.danger ? "danger" : "navy")} flex-1 md:ml-auto md:flex-none`}
          >
            {c?.confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-body-md text-ink-muted">{c?.message}</p>
    </BottomSheet>
  );
}
