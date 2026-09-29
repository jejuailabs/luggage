"use client";

/** 브라우저 인쇄·PDF 저장으로 예약증 사본을 남긴다. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-11 rounded-[var(--radius-button)] border border-line px-4 text-sm print:hidden"
    >
      {label}
    </button>
  );
}
