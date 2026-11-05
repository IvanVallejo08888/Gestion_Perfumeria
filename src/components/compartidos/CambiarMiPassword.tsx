/**
 * Formulario "Mi cuenta": el usuario conectado (administrador o vendedor) cambia su contraseña.
 */
"use client";

import { useState, type FormEvent } from "react";
import { Boton } from "@/components/ui/Boton";
import { CampoPassword } from "@/components/ui/Campo";
import { EncabezadoPagina, Mensaje, Tarjeta } from "@/components/ui/Basicos";
import { useAvisos } from "@/components/ui/Avisos";
import { ReglasPassword } from "@/components/ui/ReglasPassword";
import { api } from "@/lib/http";
import { passwordEsValida } from "@/lib/validaciones";

export function CambiarMiPassword() {
  const avisos = useAvisos();
  const [actual, setActual] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!actual) return setError("Escribe tu contraseña actual.");
    if (!passwordEsValida(password)) return setError("La nueva contraseña no cumple todos los requisitos.");
    if (password !== confirmar) return setError("Las contraseñas nuevas no coinciden.");

    setCargando(true);
    try {
      await api("/api/auth/password", { method: "PUT", json: { actual, password, confirmarPassword: confirmar } });
      avisos.exito("Tu contraseña se cambió correctamente.");
      setActual("");
      setPassword("");
      setConfirmar("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <EncabezadoPagina titulo="Mi cuenta" descripcion="Cambia tu contraseña cuando lo necesites." />
      <Tarjeta className="max-w-2xl">
        <form onSubmit={enviar} className="space-y-5" noValidate>
          {error && <Mensaje tono="peligro">{error}</Mensaje>}
          <CampoPassword etiqueta="Contraseña actual" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} obligatorio />
          <CampoPassword etiqueta="Nueva contraseña" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} obligatorio />
          <CampoPassword etiqueta="Repite la nueva contraseña" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} obligatorio />
          <ReglasPassword valor={password} confirmacion={confirmar} />
          <Boton type="submit" cargando={cargando} icono="llave">
            Guardar nueva contraseña
          </Boton>
        </form>
      </Tarjeta>
    </>
  );
}
