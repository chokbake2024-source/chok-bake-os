"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "./supabase";

const RUTAS = [
  { href: "/panel", label: "Panel" },
  { href: "/agenda", label: "Agenda" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/nuevo-pedido", label: "+ Nuevo" },
];

export default function Protegido({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<"cargando" | "ok">("cargando");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setEstado("ok");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (estado === "cargando") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.22em] text-carbon/40">
          Verificando acceso…
        </span>
      </main>
    );
  }

  return (
    <>
      <nav className="flex items-center gap-1 border-b border-carbon/20 px-5 py-2.5">
        <span className="font-display mr-3 text-lg leading-none tracking-[0.12em] text-vino">
          CHOK
        </span>
        {RUTAS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className={`px-2.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition ${
              pathname === r.href
                ? "bg-vino text-hueso"
                : "text-carbon/55 hover:text-vino"
            }`}
          >
            {r.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="ml-auto font-mono text-[0.62rem] uppercase tracking-[0.16em] text-carbon/40 transition hover:text-vino"
        >
          Salir
        </button>
      </nav>
      {children}
    </>
  );
}
