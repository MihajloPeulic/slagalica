import Link from "next/link";
import SignUpForm from "./SignUpForm";

export default function RegisterPage() {
  return (
    <main className="page-container page-spacing flex min-h-[100dvh] flex-col justify-center">
      <header className="mb-8 text-center">
        <p className="eyebrow">
          Registracija
        </p>

        <h1 className="page-title mt-1">
          Napravi nalog
        </h1>

        <p className="secondary-text mt-2">
          Pridruži se i kreni sa takmičenjem.
        </p>
      </header>

      <SignUpForm />

      <footer className="mt-8 text-center">
        <p className="secondary-text">
          Već imaš nalog?{" "}
          <Link
            href="/login"
            className="font-black text-primary transition-colors hover:text-primary-hover"
          >
            Prijavi se
          </Link>
        </p>
      </footer>
    </main>
  );
}