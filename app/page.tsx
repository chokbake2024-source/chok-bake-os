import Link from "next/link";
import { SERVICIOS, PUNTO_RECOGIDA, CIUDAD, fmt } from "./lib/negocio";

/** Corte transversal en miniatura: el mismo gesto de la lámina Estratos. */
function Corte({ bandas }: { bandas: [string, number][] }) {
  const total = bandas.reduce((s, b) => s + b[1], 0);
  let acum = 0;
  const stops = bandas
    .map(([color, peso]) => {
      const desde = (acum / total) * 100;
      acum += peso;
      const hasta = (acum / total) * 100;
      return `${color} ${desde}% ${hasta}%`;
    })
    .join(", ");
  return (
    <span
      aria-hidden
      className="block h-11 w-11 shrink-0 rounded-full ring-1 ring-vino/25"
      style={{ backgroundImage: `linear-gradient(to bottom, ${stops})` }}
    />
  );
}

const CORTES: Record<string, [string, number][]> = {
  cuchareables: [
    ["#c49da0", 2],
    ["#5a1226", 1],
    ["#f6f1e8", 1.4],
    ["#8c2740", 2.2],
    ["#c49da0", 1],
  ],
  "mesas-frias": [
    ["#f6f1e8", 1.2],
    ["#8c2740", 1],
    ["#c49da0", 2.4],
    ["#b08d57", 0.6],
    ["#5a1226", 1.8],
  ],
  tortas: [
    ["#5a1226", 1.6],
    ["#c49da0", 1],
    ["#8c2740", 2.4],
    ["#f6f1e8", 1],
    ["#5a1226", 1.4],
  ],
};

export default function Portada() {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-7">
      {/* cabecera clínica */}
      <div className="flex items-baseline justify-between pt-9">
        <span className="rotulo">Cúcuta</span>
        <span className="rotulo">Postres artesanales</span>
      </div>
      <div className="mt-3 h-px bg-carbon/25" />

      {/* wordmark */}
      <header className="pt-10 text-center">
        <h1 className="font-display text-[3.4rem] leading-[0.95] tracking-[0.16em] text-vino">
          CHOK BAKE
        </h1>
        <p className="font-serif mt-4 text-[1.05rem] italic text-vino-m">
          Nada de valor se hace de una sola vez.
        </p>
      </header>

      <div className="mt-9 h-px bg-carbon/25" />

      {/* servicios */}
      <span className="rotulo mt-5 block">I. Servicios</span>

      <nav className="mt-5 flex flex-col">
        {SERVICIOS.map((s, i) => (
          <Link
            key={s.slug}
            href={`/${s.slug}`}
            className={`group flex items-center gap-5 py-6 transition-colors hover:bg-perga/70 ${
              i > 0 ? "border-t border-carbon/15" : ""
            }`}
          >
            <Corte bandas={CORTES[s.slug]} />

            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2.5">
                <span className="font-mono text-[0.62rem] tracking-[0.2em] text-laton">
                  {s.indice}
                </span>
                <span className="font-display text-2xl leading-none text-vino">
                  {s.nombre}
                </span>
              </span>
              <span className="mt-2 block text-[0.9rem] leading-snug text-carbon">
                {s.claim}
              </span>
              <span className="mt-1 block text-[0.78rem] leading-snug text-carbon/60">
                {s.detalle}
              </span>
              <span className="rotulo mt-2.5 block !text-carbon/45 !tracking-[0.14em]">
                {s.nota}
              </span>
            </span>

            <span className="flex shrink-0 flex-col items-end gap-1.5 self-start pt-1">
              {s.desde !== null && (
                <>
                  <span className="rotulo !text-[0.55rem]">desde</span>
                  <span className="font-display text-lg leading-none text-vino-m">
                    {fmt(s.desde)}
                  </span>
                </>
              )}
              <span className="mt-1 text-vino/30 transition group-hover:translate-x-0.5 group-hover:text-vino">
                →
              </span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="h-px bg-carbon/25" />

      {/* punto de recogida */}
      <section className="py-7">
        <span className="rotulo">II. Punto de recogida</span>
        <p className="mt-3 text-[0.92rem] leading-relaxed text-carbon">
          {PUNTO_RECOGIDA}
        </p>
        <p className="mt-2 text-[0.78rem] leading-relaxed text-carbon/55">
          El domicilio se coordina y se cobra aparte con el equipo.
        </p>
      </section>

      <div className="mt-auto h-px bg-carbon/25" />
      <footer className="flex items-baseline justify-between py-5">
        <span className="rotulo !text-carbon/40">Chok Bake · {CIUDAD}</span>
        <span className="rotulo">N.º 001</span>
      </footer>
    </div>
  );
}
