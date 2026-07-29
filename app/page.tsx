import Link from "next/link";
import { SERVICIOS, PUNTO_RECOGIDA, CIUDAD } from "./lib/negocio";

export default function Portada() {
  return (
    <>
      <header className="bg-rojo px-5 py-4 text-center shadow-[0_2px_16px_rgba(117,19,44,.3)]">
        <h1 className="font-display text-2xl font-black tracking-[3px] text-amarillo">
          CHOK BAKE
        </h1>
        <p className="mt-0.5 text-[.65rem] uppercase tracking-[2px] text-rosado">
          ✦ Postres artesanales ✦
        </p>
      </header>

      <section className="bg-rosado px-5 py-7 text-center">
        <span className="inline-block rounded-full bg-rojo px-3 py-1 text-[.62rem] font-bold uppercase tracking-[2.5px] text-amarillo">
          {CIUDAD}
        </span>
        <h2 className="font-display mt-3 text-2xl leading-tight text-rojo">
          ¿Qué se te antoja hoy?
        </h2>
        <p className="mt-1 text-sm text-rojo/70">
          Elegí el servicio y armá tu pedido en un minuto
        </p>
      </section>

      <main className="mx-auto w-full max-w-[520px] flex-1 px-4 py-6">
        <div className="flex flex-col gap-3">
          {SERVICIOS.map((s) => (
            <Link
              key={s.slug}
              href={`/${s.slug}`}
              className="group flex items-start gap-4 rounded-2xl border-[1.5px] border-rojo/10 bg-blanco p-5 shadow-[0_3px_16px_rgba(117,19,44,.07)] transition hover:-translate-y-0.5 hover:border-rojo/30 hover:shadow-[0_6px_20px_rgba(117,19,44,.14)]"
            >
              <span className="text-3xl leading-none">{s.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-lg font-bold text-rojo">
                  {s.nombre}
                </span>
                <span className="mt-0.5 block text-sm font-medium text-texto">
                  {s.claim}
                </span>
                <span className="mt-1.5 block text-[.78rem] text-texto/70">
                  {s.detalle}
                </span>
                <span className="mt-2 inline-block rounded-md bg-rosado/40 px-2 py-1 text-[.68rem] font-medium text-rojo">
                  {s.nota}
                </span>
              </span>
              <span className="self-center text-xl text-rojo/40 transition group-hover:translate-x-0.5 group-hover:text-rojo">
                ›
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border-[1.5px] border-rojo/10 bg-blanco p-5">
          <h3 className="text-[.7rem] font-bold uppercase tracking-wider text-rojo">
            Punto de recogida
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-texto/80">
            {PUNTO_RECOGIDA}
          </p>
          <p className="mt-2 text-[.72rem] text-texto/60">
            🛵 El domicilio se coordina y se cobra aparte con el equipo.
          </p>
        </div>
      </main>

      <footer className="py-4 text-center text-[.67rem] tracking-wide text-rojo/50">
        © Chok Bake · Postres artesanales · {CIUDAD}
      </footer>
    </>
  );
}
