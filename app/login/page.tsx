"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { Campo, Regla, Rotulo, inputCls } from "../lib/ui";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar() {
    setMsg("");
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    setCargando(false);
    if (error) {
      setMsg("Correo o contraseña incorrectos.");
      return;
    }
    router.push("/panel");
  }

  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center px-7 py-16">
      <Rotulo>Acceso del equipo</Rotulo>
      <h1 className="font-display mt-3 text-[2.6rem] leading-none tracking-[0.12em] text-vino">
        CHOK BAKE
      </h1>
      <div className="my-7">
        <Regla />
      </div>

      <Campo label="Correo">
        <input
          className={inputCls}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="correo@ejemplo.com"
        />
      </Campo>
      <Campo label="Contraseña">
        <input
          className={inputCls}
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          onKeyDown={(e) => {
            if (e.key === "Enter") entrar();
          }}
        />
      </Campo>

      <button
        type="button"
        onClick={entrar}
        disabled={cargando}
        className="mt-6 w-full border border-vino bg-vino px-5 py-3.5 text-[0.9rem] font-medium text-hueso transition hover:bg-vino-m disabled:opacity-50"
      >
        {cargando ? "Entrando…" : "Entrar"}
      </button>

      {msg && (
        <p className="mt-4 border border-vino/30 bg-vino/[0.06] px-3.5 py-2.5 text-[0.8rem] text-vino">
          {msg}
        </p>
      )}
    </div>
  );
}
