"use client";

import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function ErrorPage({
  error,
  reset,
}: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="phone-frame flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full">
        <div className="card-main relative overflow-hidden px-6 py-10 text-center">
          <div
            className="
              pointer-events-none
              absolute
              left-1/2 top-0
              h-40 w-40
              -translate-x-1/2 -translate-y-1/2
              rounded-full
              bg-primary-back
              blur-3xl
            "
          />

          <div className="relative">
            <div
              className="
                mx-auto
                mb-6
                flex
                h-20
                w-20
                items-center
                justify-center
                rounded-2xl
                border
                border-border
                bg-surface-light
                text-3xl
                font-black
                text-primary
              "
            >
              !
            </div>

            <h1 className="text-h1 mb-3">
              Nešto je pošlo po zlu
            </h1>

            <p
              className="
                mx-auto
                max-w-xs
                text-sm
                leading-6
                text-text-secondary
              "
            >
              Došlo je do neočekivane greške.
              Možeš pokušati ponovo bez napuštanja stranice.
            </p>
          </div>

          <div className="my-7 h-px bg-border" />

          <button
            onClick={reset}
            className="
              btn-primary
              h-12
              w-full
              px-5
              text-sm
              cursor-pointer
            "
          >
            Pokušaj ponovo
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-text-muted">
          Ako se problem ponavlja, osvježi aplikaciju.
        </p>
      </div>
    </main>
  );
}