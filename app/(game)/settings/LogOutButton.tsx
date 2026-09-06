
"use client";

import { useState } from "react";
import {
  Loader2,
  LogOut,
} from "lucide-react";

import { LogOutAction } from "@/actions/auth";

import { Button } from "@/components/ui/Button";

export default function LogOutButton() {
  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      const res =
        await LogOutAction();

      if (res?.error) {
        throw new Error(
          res.error,
        );
      }
    } catch (error) {
      console.error(
        "Greška pri odjavljivanju:",
        error,
      );

      setIsLoggingOut(false);
    }
  }

  return (
    <Button
      type="button"
      variant="danger"
      fullWidth
      disabled={isLoggingOut}
      onClick={handleLogout}
      className="justify-start"
    >
      {isLoggingOut ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />

          Odjavljivanje...
        </>
      ) : (
        <>
          <LogOut className="h-4 w-4" />

          Odjavi se
        </>
      )}
    </Button>
  );
}
