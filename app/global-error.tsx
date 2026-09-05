"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="bs">
      <body className="bg-background text-text">
        <main className="flex min-h-dvh items-center justify-center px-5">
          <div
            className="
              w-full
              max-w-md
              rounded-2xl
              border
              border-[#262626]
              bg-[#171717]
              p-7
              text-center
            "
          >
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
                border-[#262626]
                bg-[#212121]
                text-3xl
                font-black
                text-[#f59e0b]
              "
            >
              !
            </div>

            <h1 className="mb-3 text-2xl font-bold">
              Aplikacija je naišla na problem
            </h1>

            <p className="mb-6 text-sm leading-6 text-[#a1a1aa]">
              Nešto nije uspjelo da se učita kako treba.
            </p>

            <button
              onClick={reset}
              className="
                h-12
                w-full
                cursor-pointer
                rounded-xl
                bg-[#f59e0b]
                font-bold
                text-black
              "
            >
              Pokušaj ponovo
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}