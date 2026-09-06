"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Play,
} from "lucide-react";

import {
  createGameRoom,
  joinGameRoomOnStart,
} from "@/actions/game";

import { Button } from "@/components/ui/Button";

export default function StartGame() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  async function handleStartGame() {
    if (loading) return;

    setLoading(true);

    try {
      const { roomId } =
        await joinGameRoomOnStart();

      if (roomId) {
        router.push(
          `/igra/${roomId}`,
        );

        return;
      }

      const res =
        await createGameRoom();

      if (res?.error) {
        // Kasnije ovo možemo zamijeniti
        // standardnim toast/error sistemom.
        alert(res.error);

        return;
      }

      if (!res?.roomId) {
        alert(
          "Nije moguće pokrenuti igru.",
        );

        return;
      }

      router.push(
        `/igra/${res.roomId}`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
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
          <Play className="h-5 w-5 fill-current" />
          Započni igru
        </>
      )}
    </Button>
  );
}