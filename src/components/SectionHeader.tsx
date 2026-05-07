import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export default function SectionHeader({
  title,
  linkTo,
  linkLabel,
  badge,
}: {
  title: string;
  linkTo?: string;
  linkLabel?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-3 mt-6 flex items-end justify-between">
      <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        {title}
        {badge}
      </h2>
      {linkTo && (
        <Link to={linkTo} className="flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80">
          {linkLabel ?? "View all"}
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
