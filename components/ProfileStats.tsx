import {
  Swords,
  Target,
  Trophy,
} from "lucide-react";

type StatTone =
  | "green"
  | "red"
  | "neutral";

interface ProfileStatsProps {
  wins: number;
  losses: number;
  draws: number;
  type: "mine" | "friend"
}

export default function ProfileStats({
  wins,
  losses,
  draws,
  type
}: ProfileStatsProps) {
  const totalGames =
    wins + losses + draws;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label={type === "mine" ? "Pobjede" : "Ti"}
          value={wins}
          icon={Trophy}
          tone="green"
        />

        <StatCard
          label={"Nerešeno"}
          value={draws}
          icon={Swords}
          tone="neutral"
        />

        <StatCard
          label={type === "mine" ? "Porazi" : "On"}
          value={losses}
          icon={Target}
          tone="red"
        />
      </div>

      <p className="secondary-text mt-2 text-right">
        {totalGames}{" "}
        {totalGames === 1
          ? "partija"
          : "partija"}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: StatTone;
}) {
  const styles = {
    green: {
      wrapper:
        "border-emerald-500/20 bg-emerald-500/5",
      icon:
        "bg-emerald-500/10 text-emerald-400",
      value:
        "text-emerald-400",
    },

    red: {
      wrapper:
        "border-red-500/20 bg-red-500/5",
      icon:
        "bg-red-500/10 text-red-400",
      value:
        "text-red-400",
    },

    neutral: {
      wrapper:
        "border-border bg-surface",
      icon:
        "bg-surface-light text-text-secondary",
      value:
        "text-text",
    },
  };

  const style = styles[tone];

  return (
    <div
      className={`
        rounded-xl
        border
        p-3
        ${style.wrapper}
      `}
    >
      <div
        className={`
          flex
          h-8
          w-8
          items-center
          justify-center
          rounded-lg
          ${style.icon}
        `}
      >
        <Icon className="h-4 w-4" />
      </div>

      <p
        className={`
          mt-3
          text-xl
          font-black
          tabular-nums
          ${style.value}
        `}
      >
        {value}
      </p>

      <p className="secondary-text mt-1 truncate">
        {label}
      </p>
    </div>
  );
}