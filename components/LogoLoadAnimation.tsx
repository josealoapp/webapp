"use client";

export default function LogoLoadAnimation({ fullscreen = false }: { fullscreen?: boolean }) {
  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-950"
          : "flex items-center justify-center"
      }
    >
      <video
        src="/logo-load.webm"
        autoPlay
        loop
        muted
        playsInline
        className="h-14 w-14 object-contain"
        aria-label="Cargando"
      />
    </div>
  );
}
