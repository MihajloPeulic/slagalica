interface GameOverCardProps {
  gameName: string;
  icon: React.ElementType;
  playerScore: number;
  opponentScore: number;
  igrac1: string;
  igrac2: string;
}

export function GameOverCard({
  gameName,
  icon: Icon,
  playerScore,
  opponentScore,
  igrac1,
  igrac2,
}: GameOverCardProps) {
  return (
    <div className="card-base card-padding flex w-full max-w-xs flex-col items-center text-center shadow-lg">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>

      <div className="mb-6">
        <p className="eyebrow">
          Završeno
        </p>

        <h2 className="section-title mt-1">
          {gameName}
        </h2>
      </div>

      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4">
        <ScoreBlock
          username={
            igrac1 || "Plavi"
          }
          score={playerScore}
          tone="blue"
        />

        <div className="h-10 w-px bg-border" />

        <ScoreBlock
          username={
            igrac2 || "Crveni"
          }
          score={opponentScore}
          tone="red"
        />
      </div>
    </div>
  );
}

function ScoreBlock({
  username,
  score,
  tone,
}: {
  username: string;
  score: number;
  tone: "blue" | "red";
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="secondary-text truncate">
        {username}
      </p>

      <p
        className={`
          mt-1
          text-3xl
          font-black
          ${
            tone === "blue"
              ? "text-blue-500"
              : "text-red-500"
          }
        `}
      >
        {score}
      </p>
    </div>
  );
}