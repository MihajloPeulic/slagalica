import Image from "next/image";

export default function MainLogo() {
  return (
    <div
      className="ml-auto mr-auto relative flex w-full items-center justify-center"
      aria-label="Slagalica"
    >
      {/* Glow iza loga */}
      <div
        className="
          pointer-events-none
          absolute
          left-1/2 top-1/2
          h-24 w-72
          -translate-x-1/2 -translate-y-1/2
          rounded-full
          bg-primary/15
          blur-[60px]
        "
      />

      <h1 className="relative flex w-full items-center justify-center select-none">
        <Image
          src="/images/slagalica.png"
          alt="Slagalica"
          width={900}
          height={300}
          priority
          className="
            h-auto
            w-[290px]
            max-w-full
            object-contain
            drop-shadow-[0_0_18px_rgba(245,158,11,0.18)]
            sm:w-[340px]
          "
        />
      </h1>
    </div>
  );
}
