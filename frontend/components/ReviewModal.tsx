"use client";

import { useEffect, useRef, useState } from "react";
import { Check, TriangleAlert, X } from "lucide-react";

export type ReviewLine = { label: string; value: string };

type Props = {
  title: string;
  lines: ReviewLine[];
  total: ReviewLine;
  note: string;            // e.g. "Airtime after purchase: ₦1,050"
  confirmLabel: string;    // e.g. "Pay ₦800"
  successTitle: string;
  successText: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

// Review, pay, done. The parent mounts it only while open, so its state resets every time.
export default function ReviewModal(p: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) p.onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [busy, p]);

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await p.onConfirm();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal__backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) p.onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        {done ? (
          <div className="modal__done">
            <span className="modal__check"><Check size={30} strokeWidth={3} /></span>
            <h2 id="modal-title" className="modal__title">{p.successTitle}</h2>
            <p>{p.successText}</p>
            <button ref={primaryRef} className="btn btn--primary btn--lg" onClick={p.onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="modal__head">
              <h2 id="modal-title" className="modal__title">{p.title}</h2>
              <button className="iconBtn" onClick={p.onClose} disabled={busy} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <dl className="modal__lines">
              {p.lines.map((l) => (
                <div key={l.label}><dt>{l.label}</dt><dd>{l.value}</dd></div>
              ))}
              <div className="modal__total"><dt>{p.total.label}</dt><dd className="num">{p.total.value}</dd></div>
            </dl>
            <p className="modal__note">{p.note}</p>

            {error && (
              <p className="formError" role="alert"><TriangleAlert size={18} />{error}</p>
            )}

            <div className="modal__actions">
              <button ref={primaryRef} className="btn btn--primary btn--lg" onClick={confirm} disabled={busy}>
                {busy ? "Processing..." : p.confirmLabel}
              </button>
              <button className="btn btn--ghost btn--lg" onClick={p.onClose} disabled={busy}>Cancel</button>
            </div>
            <p className="modal__fine">Simulated payment. No real money moves.</p>
          </>
        )}
      </div>
    </div>
  );
}
