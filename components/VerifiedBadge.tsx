import { BadgeCheck } from "lucide-react";

export default function VerifiedBadge({ className = "" }: { className?: string }) {
  return <BadgeCheck className={["h-4 w-4 text-orange-400", className].join(" ").trim()} />;
}
