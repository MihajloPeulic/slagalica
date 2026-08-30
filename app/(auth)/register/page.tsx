

import Link from "next/link";
import SignUpForm from "./SignUpForm";

export default function RegisterPage() {
  

  return (
    <main className="phone-frame relative flex flex-col justify-center px-6 min-h-[100dvh] bg-background z-0 overflow-hidden py-10">
      
      {/* 🌟 POZADINSKI SJAJ 🌟 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/10 blur-[130px] rounded-full pointer-events-none -z-10"></div>

      {/* HEADER */}
      <header className="mb-8 text-center z-10">
        <h1 className="text-4xl font-black tracking-tight text-text drop-shadow-sm mb-2">
          Napravi nalog
        </h1>
        <p className="text-sm font-medium text-text-secondary">
          Pridruži se i kreni sa takmičenjem
        </p>
      </header>

      {/* PRIKAZ GREŠKE */}
      

      {/* FORMA */}
      
      <SignUpForm></SignUpForm>

      {/* FOOTER - PRELAZAK NA LOGIN */}
      <footer className="mt-8 text-center z-10">
        <p className="text-sm text-text-secondary font-medium">
          Već imaš nalog?{" "}
          <Link href="/login" className="font-bold text-primary hover:text-primary-hover transition-colors">
            Prijavi se
          </Link>
        </p>
      </footer>

    </main>
  );
}