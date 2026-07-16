"use client";

import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@/lib/ui";

export function Header({
  title,
  subtitle,
  right,
  back = true,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  back?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-3 px-5 pb-2.5 pt-[max(56px,env(safe-area-inset-top))]">
      {back && (
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-[#ececf4] bg-white shadow-[0_2px_8px_rgba(30,27,75,0.04)]"
        >
          <ChevronLeftIcon />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[19px] font-extrabold tracking-[-0.02em] text-[#1e1b4b]">
          {title}
        </div>
        {subtitle && (
          <div className="mt-px text-[12.5px] font-semibold text-[#9b9aaa]">
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}
