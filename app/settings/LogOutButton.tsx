"use client"

import { LogOutAction } from "@/actions/auth";
import { LogOut } from "lucide-react";
import { useState } from "react";

export default function LogOutButton(){
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    async function handleLogout() {
        setIsLoggingOut(true);
        
        const res = await LogOutAction()

        if(res?.error){
            throw new Error(res.error)
            setIsLoggingOut(false);
        }
    }

    return( 
        <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="group flex items-center justify-between p-4 rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm transition-all hover:bg-red-500/10 hover:border-red-500/40 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
            <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                    <LogOut className="h-6 w-6" />
                </div>
                <div className="flex flex-col text-left">
                    <span className="font-bold text-red-500 text-lg group-hover:text-red-400 transition-colors">
                        {isLoggingOut ? "Odjavljivanje..." : "Odjavi se"}
                    </span>
                </div>
            </div>
        </button>
    )
}