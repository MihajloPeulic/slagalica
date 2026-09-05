import Link from "next/link";

export default function RateLimitedPage() {
  return (
    <main className="phone-frame flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full">
        <div className="card-main relative overflow-hidden px-6 py-10 text-center">
          {/* Suptilan glow */}
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
            {/* Ikonica / status */}
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
              429
            </div>

            <h1 className="text-h1 mb-3">
              Malo prebrzo
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
              Poslao si previše zahtjeva u kratkom periodu.
              Sačekaj malo pa pokušaj ponovo.
            </p>
          </div>

          <div className="my-7 h-px w-full bg-border" />

          <div className="flex flex-col gap-3">
            <Link
              href="/home"
              className="
                btn-primary
                flex
                h-12
                items-center
                justify-center
                px-5
                text-sm
              "
            >
              Nazad na početnu
            </Link>

            <Link
              href="/"
              className="
                button-radius
                flex
                h-12
                items-center
                justify-center
                border
                border-border
                bg-surface-light
                px-5
                text-sm
                font-semibold
                text-text-secondary
                transition
                hover:border-text-muted
                hover:text-text
              "
            >
              Idi na landing stranicu
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-text-muted">
          Greška 429 · Previše zahtjeva
        </p>
      </div>
    </main>
  );
}
