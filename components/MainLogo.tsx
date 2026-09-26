import Image from "next/image";

export default function MainLogo() {
  return (
    <div className="relative flex w-full flex-col items-center" aria-label="Slagalica">
      <div className="quiz-float relative mb-2 flex h-28 w-28 items-center justify-center rounded-full bg-surface-light sm:h-32 sm:w-32">
        <Image
          src="/images/lavic.png"
          alt=""
          width={112}
          height={112}
          priority
          className="h-24 w-24 object-contain sm:h-28 sm:w-28"
        />
      </div>
      <h1 className="text-center text-[clamp(2.25rem,10vw,3.2rem)] font-black leading-none tracking-[-0.075em] text-text">
        Slagalica<span className="text-primary">.</span>
      </h1>
      <p className="mt-3 text-sm font-semibold tracking-tight text-text-secondary">
        Malo znanja. Mnogo zabave.
      </p>
    </div>
  );
}
