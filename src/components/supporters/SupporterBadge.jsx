import { Sparkles } from "lucide-react";

/** Small cosmetic badge shown next to a supporter's name. */
export default function SupporterBadge({ className = "" }) {
  return (
    <span
      title="Supporter"
      className={`inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500 ${className}`}
    >
      <Sparkles size={11} />
      Supporter
    </span>
  );
}
