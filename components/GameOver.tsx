interface GameOverCardProps {
    gameName: string;
    icon: React.ElementType; // Prihvata Lucide ikonicu kao komponentu
    playerScore: number;
    opponentScore: number;
    igrac1: string;
    igrac2: string;
}

export function GameOverCard({ gameName, icon: Icon, playerScore, opponentScore, igrac1 , igrac2  }: GameOverCardProps) {
    return (
        <div className="flex flex-col items-center justify-center p-8 bg-surface/80 backdrop-blur-md border border-border rounded-[2rem] w-full max-w-[320px] shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4 shadow-inner">
                <Icon className="h-8 w-8 text-primary" />
            </div>
            
            <h2 className="text-xl font-black text-text mb-8 uppercase tracking-widest text-center">
                {gameName} <br/> <span className="text-sm text-text-muted">završeno</span>
            </h2>
            
            {/* SIMETRIČNI KONTEJNER */}
            <div className="flex w-full justify-around items-center px-2">
                <div className="flex flex-col items-center w-28 text-center">
                    <span className="text-xs font-bold text-text-muted mb-1 uppercase tracking-wider">{igrac1 ? igrac1 : "Plavi"}</span>
                    <span className="text-4xl font-black text-blue-500">{playerScore}</span>
                </div>
                
                <div className="h-12 w-[2px] bg-border/50 rounded-full shrink-0"></div>
                
                <div className="flex flex-col items-center w-28 text-center">
                    <span className="text-xs font-bold text-text-muted mb-1 uppercase tracking-wider">{igrac2 ? igrac2 : "Crveni"}</span>
                    <span className="text-4xl font-black text-red-500">{opponentScore}</span>
                </div>
            </div>
        </div>
    );
}