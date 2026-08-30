"use client"
import { RegisterAction } from "@/actions/auth";
import { ArrowRight, Mail, Lock, User } from "lucide-react";
import { useState } from "react";

export default function SignUpForm() {

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError(null)

        const formData = new FormData(e.currentTarget)

        const res = await RegisterAction(formData)

        if(res?.error){
          setError(res.error)
          setLoading(false);
        }

    }

    return(

        <>

        {error && (
            <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm font-semibold text-red-500 text-center z-10">
            {error}
            </div>
        )}


        <form onSubmit={handleRegister} className="flex flex-col gap-4 z-10">
        
        <div>
          <label htmlFor="username" className="block text-sm font-semibold text-text-secondary mb-1.5 ml-1">
            Korisničko ime
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
            <input
              id="username"
              name="username"
              type="text"
              required
              placeholder="igrac123"
              className="input-box w-full pl-12 py-3 bg-surface/80 backdrop-blur-sm border-border focus:border-primary transition-colors placeholder:text-text-muted"
            />
          </div>
        </div>

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
              className="input-box w-full pl-12 py-3 bg-surface/80 backdrop-blur-sm border-border focus:border-primary transition-colors placeholder:text-text-muted"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-text-secondary mb-1.5 ml-1">
            Lozinka
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="input-box w-full pl-12 py-3 bg-surface/80 backdrop-blur-sm border-border focus:border-primary transition-colors placeholder:text-text-muted"
            />
          </div>
        </div>

        <div>
          <label htmlFor="confirm_password" className="block text-sm font-semibold text-text-secondary mb-1.5 ml-1">
            Potvrdi lozinku
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              placeholder="••••••••"
              className="input-box w-full pl-12 py-3 bg-surface/80 backdrop-blur-sm border-border focus:border-primary transition-colors placeholder:text-text-muted"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="cursor-pointer group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 mt-4 text-lg font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(245,158,11,0.15)] disabled:opacity-70 disabled:hover:scale-100"
        >
          {loading ? "Pravljenje naloga..." : "Registruj se"}
          {!loading && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
        </button>
      </form>

    </>
    )
}