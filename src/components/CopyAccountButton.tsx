"use client";

import { useState } from "react";

interface CopyAccountButtonProps {
  readonly textToCopy: string;
  readonly label?: string;
}

export function CopyAccountButton({
  textToCopy,
  label = "계좌번호 복사",
}: CopyAccountButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for restricted clipboard environments
      const textarea = document.createElement("textarea");
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
        copied
          ? "bg-[#1a2744] text-white"
          : "bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white"
      }`}
    >
      {copied ? "✓ 복사 완료!" : label}
    </button>
  );
}
