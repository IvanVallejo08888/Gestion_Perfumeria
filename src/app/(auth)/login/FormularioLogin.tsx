/**
 * Formulario de inicio de sesión (administrador y vendedores usan el mismo).
 * Pide identificación y contraseña. Si la cuenta está pendiente o pausada,
 * muestra el motivo de forma clara.
 */
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Boton } from "@/components/ui/Boton";
import { Campo, CampoPassword } from "@/components/ui/Campo";
import { Mensaje } from "@/components/ui/Basicos";
import { api } from "@/lib/http";

export function FormularioLogin({ sesionExpirada }: { sesionExpirada: boolean }) {
  const [identificacion, setIdentificacion] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!identificacion.trim() || !password) {
      setError("Escribe tu identificación y tu contraseña.");
      return;
    }
    setCargando(true);
    try {
      const { destino } = await api<{ destino: string }>("/api/auth/login", {
        method: "POST",
        json: { identificacion: identificacion.trim(), password },
      });
      // Recarga completa para que el servidor lea la nueva sesión
      window.location.href = destino;
    } catch (err) {
      setError((err as Error).message);
      setCargando(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
      <h1 className="text-3xl font-bold">Iniciar sesión</h1>
      <p className="mt-1 text-lg text-texto-suave">Ingresa con tu número de identificación.</p>

      <div className="mt-5 space-y-4">
        {sesionExpirada && !error && (
          <Mensaje tono="info" titulo="Tu sesión terminó">
            Por seguridad, vuelve a ingresar tus datos.
          </Mensaje>
        )}
        {error && <Mensaje tono="peligro">{error}</Mensaje>}
      </div>

      <form onSubmit={enviar} className="mt-5 space-y-5" noValidate>
        <Campo
          etiqueta="Número de identificación"
          name="identificacion"
          inputMode="numeric"
          autoComplete="username"
          value={identificacion}
          onChange={(e) => setIdentificacion(e.target.value.replace(/\D/g, ""))}
          obligatorio
          autoFocus
        />
        <CampoPassword
          etiqueta="Contraseña"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          obligatorio
        />
        <Boton type="submit" ancho cargando={cargando} icono="cuenta">
          Entrar
        </Boton>
      </form>

      <div className="mt-6 border-t-2 border-gray-100 pt-5 text-center">
        <p className="text-lg text-texto-suave">¿Todavía no tienes cuenta?</p>
        <Link
          href="/registro"
          className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-marca-700 px-5 text-lg font-bold text-marca-800 hover:bg-marca-50"
        >
          Crear una cuenta
        </Link>
      </div>
    </div>
  );
}
