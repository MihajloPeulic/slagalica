import Link from "next/link";
import {
  ChevronRight,
  User,
} from "lucide-react";

import InAppHeader from "@/components/ui/InAppHeader";
import PageContainer from "@/components/ui/PageContainer";

import LogOutButton from "./LogOutButton";

export default function SettingsPage() {
  return (
    <PageContainer>
      <InAppHeader
        link_to="/home"
        title="Podešavanja"
      />

      <div className="flex flex-col gap-2">
        <SettingsLink
          href="/settings/nalog"
          title="Nalog"
          icon={User}
        />

        <LogOutButton />
      </div>
    </PageContainer>
  );
}

function SettingsLink({
  href,
  title,
  icon: Icon,
}: {
  href: string;
  title: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="
        group
        flex
        h-14
        items-center
        justify-between
        rounded-xl
        border
        border-border
        bg-surface
        px-4
        transition-colors
        hover:bg-surface-light
      "
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>

        <span className="text-sm font-black text-text">
          {title}
        </span>
      </div>

      <ChevronRight className="h-4 w-4 text-text-muted transition-colors group-hover:text-primary" />
    </Link>
  );
}