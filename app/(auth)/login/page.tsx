import Link from "next/link";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  

  return (
    <main className="phone-frame relative flex flex-col justify-center px-6 min-h-[100dvh] bg-background z-0 overflow-hidden">
      
      {/* 🌟 POZADINSKI SJAJ 🌟 */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-primary/15 blur-[120px] rounded-full pointer-events-none -z-10"></div>

      {/* HEADER */}
      <header className="mb-10 text-center z-10">
        <h1 className="text-4xl font-black tracking-tight text-text drop-shadow-sm mb-2">
          Dobrodošli nazad
        </h1>
        <p className="text-sm font-medium text-text-secondary">
          Prijavite se da nastavite sa igrom
        </p>
      </header>


        <LoginForm></LoginForm>
      
       <footer className="mt-8 text-center z-10">
        <p className="text-sm text-text-secondary font-medium">
          Nemaš nalog?{" "}
          <Link href="/register" className="font-bold text-primary hover:text-primary-hover transition-colors">
            Registruj se
          </Link>
        </p>
      </footer>

    </main>
  );
}