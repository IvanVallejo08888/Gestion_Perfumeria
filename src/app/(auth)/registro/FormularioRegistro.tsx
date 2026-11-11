/**
 * Registro de un nuevo vendedor.
 * Pide: nombre, identificación, correo, teléfono y contraseña (con confirmación).
 * Al terminar, informa que debe ESPERAR a que el administrador le asigne un local.
 */
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Boton } from "@/components/ui/Boton";
import { Campo, CampoPassword } from "@/components/ui/Campo";
import { Mensaje } from "@/components/ui/Basicos";
import { Icono } from "@/components/ui/Icono";
import { ReglasPassword } from "@/components/ui/ReglasPassword";
import { api } from "@/lib/http";
import { primerError, registroSchema } from "@/lib/validaciones";

const VACIO = { nombre: "", identificacion: "", correo: "", telefono: "", password: "", confirmarPassword: "" };
type Datos = typeof VACIO;

export function FormularioRegistro() {
  const [datos, setDatos] = useState<Datos>(VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof Datos, string>>>({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [cargando, setCargando] = useState(false);
  const [creada, setCreada] = useState(false);

  const cambiar = (campo: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = campo === "identificacion" ? e.target.value.replace(/\D/g, "") : e.target.value;
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((er) => ({ ...er, [campo]: undefined }));
  };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral("");

    // Validación en el navegador: muestra todos los errores a la vez, junto a cada campo
    const resultado = registroSchema.safeParse(datos);
    if (!resultado.success) {
      const nuevos: Partial<Record<keyof Datos, string>> = {};
      for (const issue of resultado.error.issues) {
        const campo = issue.path[0] as keyof Datos;
        if (!nuevos[campo]) nuevos[campo] = issue.message;
      }
      setErrores(nuevos);
      setErrorGeneral(primerError(resultado.error));
      return;
    }

    setCargando(true);
    try {
      await api("/api/auth/registro", { method: "POST", json: datos });
      setCreada(true);
    } catch (err) {
      setErrorGeneral((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  /* Pantalla de éxito: la cuenta queda en espera de asignación de local */
  if (creada) {
    return (
      <div className="w-full max-w-lg rounded-3xl bg-tarjeta p-6 text-center shadow-2xl sm:p-10" role="status">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-exito-50 text-exito-800">
          <Icono nombre="check" className="size-12" />
        </div>
        <h1 className="mt-4 text-3xl font-bold">¡Tu cuenta fue creada!</h1>
        <p className="mt-3 text-xl">
          Ahora debes <strong>esperar a que el administrador te asigne un local</strong>.
        </p>
        <p className="mt-2 text-lg text-texto-suave">
          Cuando lo haga, podrás entrar con tu número de identificación y tu contraseña.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-marca-700 px-5 text-lg font-bold text-white hover:bg-marca-800"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl rounded-3xl border border-linea bg-tarjeta p-6 shadow-xl shadow-marca-700/5 sm:p-8">
      <h1 className="text-3xl font-bold">Crear una cuenta</h1>
      <p className="mt-1 text-lg text-texto-suave">
        Completa tus datos. Los campos con <span className="font-bold text-peligro-800">*</span> son obligatorios.
      </p>

      {errorGeneral && (
        <div className="mt-5">
          <Mensaje tono="peligro">{errorGeneral}</Mensaje>
        </div>
      )}

      <form onSubmit={enviar} className="mt-5 grid gap-5 sm:grid-cols-2" noValidate>
        <Campo
          className="sm:col-span-2"
          etiqueta="Nombre completo"
          autoComplete="name"
          value={datos.nombre}
          onChange={cambiar("nombre")}
          error={errores.nombre}
          obligatorio
        />
        <Campo
          etiqueta="Número de identificación"
          inputMode="numeric"
          autoComplete="off"
          value={datos.identificacion}
          onChange={cambiar("identificacion")}
          error={errores.identificacion}
          ayuda="Solo números, sin puntos."
          obligatorio
        />
        <Campo
          etiqueta="Número de teléfono"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={datos.telefono}
          onChange={cambiar("telefono")}
          error={errores.telefono}
          obligatorio
        />
        <Campo
          className="sm:col-span-2"
          etiqueta="Correo electrónico"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={datos.correo}
          onChange={cambiar("correo")}
          error={errores.correo}
          obligatorio
        />
        <CampoPassword
          etiqueta="Contraseña"
          autoComplete="new-password"
          value={datos.password}
          onChange={cambiar("password")}
          error={errores.password}
          obligatorio
        />
        <CampoPassword
          etiqueta="Repite la contraseña"
          autoComplete="new-password"
          value={datos.confirmarPassword}
          onChange={cambiar("confirmarPassword")}
          error={errores.confirmarPassword}
          obligatorio
        />
        <div className="sm:col-span-2">
          <ReglasPassword valor={datos.password} confirmacion={datos.confirmarPassword} />
        </div>
        <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-between">
          <Link
            href="/login"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-borde px-5 text-lg font-bold hover:bg-superficie"
          >
            Ya tengo cuenta
          </Link>
          <Boton type="submit" cargando={cargando} icono="check">
            Crear mi cuenta
          </Boton>
        </div>
      </form>
    </div>
  );
}
