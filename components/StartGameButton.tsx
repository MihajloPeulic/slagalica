"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Swords } from "lucide-react";

import { createGameRoom, joinGameRoomOnStart } from "@/actions/game/game";

import { Button } from "@/components/ui/Button";
import { ErrorPopup } from "@/components/ui/ErrorPopup";

export default function StartGame() {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

    function closeErrorPopup() {
        setError(null);
        setActiveRoomId(null);
    }

    async function handleStartGame() {
        if (loading) return;

        setLoading(true);
        closeErrorPopup();

        try {
            const searchResult = await joinGameRoomOnStart();

            /*
                User već ima waiting/in_progress partiju.
                Ne redirectamo automatski - ponudimo mu povratak.
            */
            if (searchResult.kind === "active_game") {
                setActiveRoomId(searchResult.roomId);
                setError("Već imaš aktivnu partiju.");
                return;
            }

            /*
                Pronađen je novi waiting room.
            */
            if (searchResult.kind === "match_found") {
                router.push(`/igra/${searchResult.roomId}`);
                return;
            }

            if (searchResult.kind === "error") {
                setError(searchResult.error);
                return;
            }

            /*
                Nema dostupnog protivnika -> kreiraj waiting room.
            */
            const res = await createGameRoom();

            /*
                Server-side race fallback:
                createGameRoom ponovo provjerava postoji li
                aktivna partija i vraća njen roomId.
            */
            if (res?.activeRoomId) {
                setActiveRoomId(res.activeRoomId);
                setError("Već imaš aktivnu partiju.");
                return;
            }

            if (res?.error) {
                setError(res.error);
                return;
            }

            if (!res?.roomId) {
                setError("Nije moguće pokrenuti igru.");
                return;
            }

            router.push(`/igra/${res.roomId}`);
        } catch (err) {
            console.error("Start game error:", err);

            setError("Došlo je do greške. Pokušaj ponovo.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Button
                type="button"
                size="lg"
                fullWidth
                disabled={loading}
                onClick={handleStartGame}
                className="max-w-[280px] cursor-pointer"
            >
                {loading ? (
                    <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Traženje igre...
                    </>
                ) : (
                    <>
                        <Swords className="h-5 w-5 fill-current" />
                        Započni igru
                    </>
                )}
            </Button>

            <ErrorPopup
                message={error}
                onClose={closeErrorPopup}
                action={
                    activeRoomId
                        ? {
                              href: `/igra/${activeRoomId}`,
                              label: "Vrati se u partiju",
                          }
                        : undefined
                }
            />
        </>
    );
}
