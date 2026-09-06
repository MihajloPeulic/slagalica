import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type InAppHeaderProps = {
  link_to: string;
  title: string;
};

export default function InAppHeader({
  link_to,
  title,
}: InAppHeaderProps) {
  return (
    <header className="in-app-header">
      <Link
        href={link_to}
        aria-label="Nazad"
        className="icon-button absolute left-0"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <span className="text-sm font-black text-text">
        {title}
      </span>
    </header>
  );
}