"use client";

import { LogOutAction } from "@/actions/auth";
import { LogOut } from "lucide-react";
import { useState } from "react";

export default function LogOutButton() {
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    async function handleLogout() {
        try {
            setIsLoggingOut(true);

            const res = await LogOutAction();

            if (res?.error) {
                throw new Error(res.error);
            }
        } catch (error) {
            setIsLoggingOut(false);
            throw error;
        }
    }

    return (
        <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="
                cursor-pointer
                group
                flex w-full items-center justify-between
                rounded-xl
                border border-red-500/20
                bg-red-500/5
                px-4 py-3
                transition-colors
                hover:bg-red-500/10
                hover:border-red-500/30
                disabled:cursor-not-allowed
                disabled:opacity-60
            "
        >
            <div className="flex items-center gap-3">

                <div
                    className="
                        flex h-8 w-8
                        items-center justify-center
                        rounded-lg
                        bg-red-500/10
                        text-red-500
                        transition-colors
                        group-hover:bg-red-500/15
                    "
                >
                    <LogOut className="h-4 w-4" />
                </div>

                <span className="text-sm font-bold text-red-500">
                    {isLoggingOut
                        ? "Odjavljivanje..."
                        : "Odjavi se"}
                </span>

            </div>

        </button>
    );
}