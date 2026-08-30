"use client"

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Mail, Lock } from "lucide-react";
import { LoginAction } from "@/actions/auth";
import { useSearchParams } from "next/navigation";

export default function LoginForm() {
    const searchParams = useSearchParams();
    const urlError = searchParams.get("error"); // Hvata ?error=... iz URL-a

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(
        urlError === "unauthorized" ? "Niste ulogovani." : urlError
    );

    
    


    async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError(null)

        const formData = new FormData(e.currentTarget)


        const res = await LoginAction(formData)

        if(res?.error){
          setError(res.error)
          setLoading(false);
          return
        }


        
    }
    
    return(
      <>

        {error && (
              <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm font-semibold text-red-500 text-center z-10">
              {error}
              </div>
          )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5 z-10">
          
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-text-secondary mb-1.5 ml-1">
              Email adresa
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="tvoj@email.com"
                className="input-box w-full pl-12 py-3.5 bg-surface/80 backdrop-blur-sm border-border focus:border-primary transition-colors placeholder:text-text-muted"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5 ml-1 mr-1">
              <label htmlFor="password" className="text-sm font-semibold text-text-secondary">
                Lozinka
              </label>
              <Link href="/forgot-password" className="text-xs font-bold text-primary hover:text-primary-hover transition-colors">
                Zaboravljena lozinka?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="input-box w-full pl-12 py-3.5 bg-surface/80 backdrop-blur-sm border-border focus:border-primary transition-colors placeholder:text-text-muted"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 mt-2 text-lg font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(245,158,11,0.15)] disabled:opacity-70 disabled:hover:scale-100"
          >
            {loading ? "Prijavljivanje..." : "Prijavi se"}
            {!loading && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
          </button>
        </form>
      </>
     
    )
}