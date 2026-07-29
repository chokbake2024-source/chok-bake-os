import Link from "next/link";

/** Hairline. La retícula manda pero nunca se anuncia. */
export function Regla({ suave }: { suave?: boolean } = {}) {
  return <div className={`h-px ${suave ? "bg-carbon/12" : "bg-carbon/25"}`} />;
}

export function Rotulo({
  children,
  tono = "laton",
  className = "",
}: {
  children: React.ReactNode;
  tono?: "laton" | "carbon";
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-[0.66rem] uppercase tracking-[0.22em] ${
        tono === "laton" ? "text-laton" : "text-carbon/45"
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** Corte transversal en miniatura: el gesto de la lámina Estratos. */
export function Corte({
  bandas,
  size = 44,
}: {
  bandas: [string, number][];
  size?: number;
}) {
  const total = bandas.reduce((s, b) => s + b[1], 0);
  let acum = 0;
  const stops = bandas
    .map(([color, peso]) => {
      const desde = (acum / total) * 100;
      acum += peso;
      return `${color} ${desde}% ${(acum / total) * 100}%`;
    })
    .join(", ");
  return (
    <span
      aria-hidden
      className="block shrink-0 rounded-full ring-1 ring-vino/25"
      style={{
        width: size,
        height: size,
        backgroundImage: `linear-gradient(to bottom, ${stops})`,
      }}
    />
  );
}

/** Opción seleccionable. Sin colores de globo: hairline, tinte y un índice. */
export function Opcion({
  sel,
  onClick,
  titulo,
  detalle,
  precio,
  ancho,
}: {
  sel: boolean;
  onClick: () => void;
  titulo: string;
  detalle?: string | null;
  precio?: string | null;
  ancho?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1 border px-3.5 py-3 text-left transition ${
        ancho ? "col-span-2" : ""
      } ${
        sel
          ? "border-vino bg-vino/[0.07]"
          : "border-carbon/15 bg-perga/60 hover:border-vino/40 hover:bg-perga"
      }`}
    >
      <span className="flex w-full items-baseline justify-between gap-2">
        <span className={`text-[0.86rem] leading-tight ${sel ? "text-vino" : "text-carbon"}`}>
          {titulo}
        </span>
        {sel && <span className="font-mono text-[0.6rem] text-laton">✓</span>}
      </span>
      {detalle && (
        <span className="text-[0.7rem] leading-tight text-carbon/50">{detalle}</span>
      )}
      {precio && (
        <span className="font-mono text-[0.68rem] tracking-wide text-vino-m">{precio}</span>
      )}
    </button>
  );
}

export function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-4 block">
      <Rotulo>{label}</Rotulo>
      <div className="mt-1.5">{children}</div>
      {hint && (
        <span className="mt-1 block text-[0.7rem] leading-snug text-carbon/50">{hint}</span>
      )}
    </label>
  );
}

export const inputCls =
  "w-full border border-carbon/20 bg-perga px-3 py-2.5 text-[0.9rem] text-carbon outline-none transition focus:border-vino";

/** Cabecera compartida de las páginas de pedido. */
export function Cabecera({ seccion }: { seccion: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between pt-8">
        <Link href="/" className="font-mono text-[0.66rem] uppercase tracking-[0.22em] text-carbon/45 transition hover:text-vino">
          ← Chok Bake
        </Link>
        <Rotulo>{seccion}</Rotulo>
      </div>
      <div className="mt-3">
        <Regla />
      </div>
    </>
  );
}

/** Pantalla de confirmación. El pedido YA está en la base cuando se ve esto. */
export function Exito({
  id,
  href,
  nota,
}: {
  id: string;
  href: string;
  nota: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-7 py-16">
      <Rotulo>Pedido registrado</Rotulo>
      <h1 className="font-display mt-4 text-[2.6rem] leading-none tracking-[0.08em] text-vino">
        {id}
      </h1>
      <p className="font-serif mt-4 text-[1rem] italic leading-snug text-vino-m">
        Quedó guardado. Ahora avisanos por WhatsApp y el equipo te confirma por ahí.
      </p>
      <div className="my-7">
        <Regla />
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block border border-vino bg-vino px-5 py-3.5 text-center text-[0.9rem] font-medium text-hueso transition hover:bg-vino-m"
      >
        Enviar por WhatsApp
      </a>
      <p className="mt-3 text-[0.74rem] leading-snug text-carbon/55">{nota}</p>
      <Link
        href="/"
        className="mt-8 font-mono text-[0.66rem] uppercase tracking-[0.22em] text-carbon/45 transition hover:text-vino"
      >
        ← Volver al inicio
      </Link>
    </div>
  );
}

export function Titulo({ children, bajada }: { children: React.ReactNode; bajada?: string }) {
  return (
    <header className="pt-8 pb-7">
      <h1 className="font-display text-[2.6rem] leading-[1.05] tracking-[0.09em] text-vino">
        {children}
      </h1>
      {bajada && (
        <p className="font-serif mt-2.5 text-[0.98rem] italic leading-snug text-vino-m">
          {bajada}
        </p>
      )}
    </header>
  );
}
