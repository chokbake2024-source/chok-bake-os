import Link from "next/link";
import { WHATSAPP } from "../lib/negocio";
import { Cabecera, Regla, Rotulo, Titulo } from "../lib/ui";

const PENDIENTE = [
  "Sabores disponibles",
  "Tamaños y precio de cada uno",
  "Rellenos y su recargo por tamaño",
  "Extras y su precio por tamaño",
];

export default function Tortas() {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-7 pb-16">
      <Cabecera seccion="III. Tortas" />
      <Titulo bajada="Personalizadas a tu medida.">TORTAS</Titulo>

      <Regla />

      <p className="mt-6 text-[0.95rem] leading-relaxed text-carbon">
        El pedido de tortas por la web todavía no está abierto. Mientras tanto,
        escribinos por WhatsApp y lo armamos con vos.
      </p>

      <a
        href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
          "¡Hola Chok Bake! Quiero pedir una torta personalizada."
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 block border border-vino bg-vino px-5 py-3.5 text-center text-[0.9rem] font-medium text-hueso transition hover:bg-vino-m"
      >
        Pedir por WhatsApp
      </a>

      <div className="mt-10">
        <Regla suave />
      </div>

      <Rotulo className="mt-5 block">Falta para abrirlo</Rotulo>
      <ul className="mt-3 flex flex-col">
        {PENDIENTE.map((p, i) => (
          <li
            key={p}
            className={`flex items-baseline gap-3 py-2.5 ${
              i > 0 ? "border-t border-carbon/12" : ""
            }`}
          >
            <span className="font-mono text-[0.62rem] tracking-[0.18em] text-laton">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[0.86rem] text-carbon/75">{p}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[0.74rem] leading-relaxed text-carbon/50">
        El formulario ya está diseñado — es el mismo de Bianco. Solo falta cargar
        la lista de precios para que el servidor pueda calcular el total.
      </p>

      <Link
        href="/"
        className="mt-10 font-mono text-[0.66rem] uppercase tracking-[0.22em] text-carbon/45 transition hover:text-vino"
      >
        ← Volver al inicio
      </Link>
    </div>
  );
}
