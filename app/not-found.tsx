import Link from "next/link";

export default function NotFound() {
  return (
    <main className="phone-frame flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full">
        <div className="card-main relative overflow-hidden px-6 py-10 text-center">
          {/* Suptilni background detalj */}
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

          {/* 404 */}
          <div className="relative">
            <p
              className="
                mb-3
                text-7xl
                font-black
                tracking-[-0.07em]
                text-primary
                sm:text-8xl
              "
            >
              404
            </p>

            <h1 className="text-h1 mb-3">
              Ova stranica ne postoji
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
              Izgleda da si zalutao malo dalje od table.
              Vrati se nazad i nastavi igru.
            </p>
          </div>

          {/* Separator */}
          <div className="my-7 h-px w-full bg-border" />

          {/* Dugmad */}
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

        <p
          className="
            mt-4
            text-center
            text-xs
            text-text-muted
          "
        >
          Greška 404 · Stranica nije pronađena
        </p>
      </div>
    </main>
  );
}
