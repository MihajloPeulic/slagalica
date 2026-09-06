import Link from "next/link";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="page-container page-spacing flex min-h-[100dvh] flex-col justify-center">
      <header className="mb-8 text-center">
        <p className="eyebrow">
          Prijava
        </p>

        <h1 className="page-title mt-1">
          Dobrodošli nazad
        </h1>

        <p className="secondary-text mt-2">
          Prijavite se da nastavite sa igrom.
        </p>
      </header>

      <Suspense
        fallback={
          <p className="secondary-text text-center">
            Učitavanje...
          </p>
        }
      >
        <LoginForm />
      </Suspense>

      <footer className="mt-8 text-center">
        <p className="secondary-text">
          Nemaš nalog?{" "}
          <Link
            href="/register"
            className="font-black text-primary transition-colors hover:text-primary-hover"
          >
            Registruj se
          </Link>
        </p>
      </footer>
    </main>
  );
}
