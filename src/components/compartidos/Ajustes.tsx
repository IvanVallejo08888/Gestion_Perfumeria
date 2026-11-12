/**
 * Pantalla "Ajustes" (vendedor y administrador): lo que cada usuario puede personalizar o consultar.
 *  1. Apariencia: tamaño de letra (barra deslizante) y tema claro / oscuro / según el dispositivo.
 *  2. Guía de usuario: un desplegable por módulo (textos en src/lib/guia-usuario.ts).
 *  3. Quejas e inquietudes: arma un mensaje para el desarrollador por WhatsApp o correo (no se guarda nada).
 *  4. Cuenta: cambiar contraseña y cerrar sesión.
 *  5. Manual de usuario: botón que despliega una pestaña por sección (ver ManualUsuario.tsx).
 * Las preferencias se guardan en este dispositivo (ver hooks/usePreferencias.ts).
 */
"use client";

import { useId, useState, type ReactNode } from "react";
import { CambiarMiPassword } from "@/components/compartidos/CambiarMiPassword";
import { ManualUsuario } from "@/components/compartidos/ManualUsuario";
import { Boton } from "@/components/ui/Boton";
import { AreaTexto, Selector } from "@/components/ui/Campo";
import { Desplegable } from "@/components/ui/Desplegable";
import { GrupoOpciones } from "@/components/ui/GrupoOpciones";
import { Confirmar } from "@/components/ui/Modal";
import { EncabezadoPagina, Mensaje, Tarjeta } from "@/components/ui/Basicos";
import { NIVELES_TEXTO, useTamanoTexto, useTema, type PreferenciaTema } from "@/hooks/usePreferencias";
import { cerrarSesion } from "@/lib/cerrar-sesion";
import { GUIA_USUARIO, modulosPara } from "@/lib/guia-usuario";
import { asuntoSoporte, enlaceCorreoSoporte, enlaceWhatsAppSoporte, mensajeSoporte } from "@/lib/soporte";
import { PANTALLAS_QUEJA, quejaSchema, TIPOS_QUEJA, type Queja } from "@/lib/validaciones";

interface UsuarioAjustes {
  nombre: string;
  rol: "ADMIN" | "VENDEDOR";
  localNombre: string | null;
}

// Next.js las incrusta al compilar: si faltan en .env, el botón queda deshabilitado con su explicación
const SOPORTE_WHATSAPP = process.env.NEXT_PUBLIC_SOPORTE_WHATSAPP;
const SOPORTE_CORREO = process.env.NEXT_PUBLIC_SOPORTE_CORREO;

const OPCIONES_TEMA: { valor: PreferenciaTema; texto: string }[] = [
  { valor: "claro", texto: "Claro" },
  { valor: "oscuro", texto: "Oscuro" },
  { valor: "sistema", texto: "Según el dispositivo" },
];

export function Ajustes({ usuario }: { usuario: UsuarioAjustes }) {
  return (
    <>
      <EncabezadoPagina titulo="Ajustes" descripcion="Personaliza cómo se ve la aplicación, consulta la guía y escríbenos si algo falla." />
      <div className="max-w-3xl space-y-10">
        <Seccion titulo="Apariencia">
          <Apariencia />
        </Seccion>
        <Seccion titulo="Guía de usuario">
          <GuiaUsuario rol={usuario.rol} />
        </Seccion>
        <Seccion titulo="Quejas e inquietudes">
          <FormularioQueja usuario={usuario} />
        </Seccion>
        <Seccion titulo="Cuenta">
          <Cuenta />
        </Seccion>
        <Seccion titulo="Manual de usuario">
          <ManualUsuario rol={usuario.rol} />
        </Seccion>
      </div>
    </>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 text-2xl text-acento">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/* ---------------------------------- 1. Apariencia ---------------------------------- */

function Apariencia() {
  const { nivel, cambiar } = useTamanoTexto();
  const tema = useTema();
  const idBarra = useId();
  const indice = Math.max(0, NIVELES_TEXTO.findIndex((n) => n.valor === nivel));
  const etiquetaNivel = NIVELES_TEXTO[indice].etiqueta;

  return (
    <Tarjeta className="space-y-8">
      <div>
        <label htmlFor={idBarra} className="block text-lg font-bold text-texto">
          Tamaño de letra: <span className="text-acento">{etiquetaNivel}</span>
        </label>
        <p className="text-base text-texto-suave">Mueve la barra o usa las flechas del teclado. El cambio se aplica a toda la aplicación.</p>
        <input
          id={idBarra}
          type="range"
          min={0}
          max={NIVELES_TEXTO.length - 1}
          step={1}
          value={indice}
          onChange={(e) => cambiar(NIVELES_TEXTO[Number(e.target.value)].valor)}
          aria-valuetext={etiquetaNivel}
          className="mt-3 block h-12 w-full cursor-pointer accent-marca-700"
        />
        {/* Marcas de cada paso (la barra ya anuncia el nivel a lectores de pantalla) */}
        <div className="flex justify-between text-base text-texto-suave" aria-hidden="true">
          {NIVELES_TEXTO.map((n) => (
            <span key={n.valor} className={n.valor === nivel ? "font-bold text-acento" : ""}>
              {n.etiqueta}
            </span>
          ))}
        </div>
        <p className="mt-4 rounded-xl border-2 border-dashed border-linea-fuerte bg-superficie p-4 text-texto">
          <span className="font-bold">Así se verá la letra:</span> Factura N° 000123 · Agua de Rosa x2 — $ 100.000
        </p>
      </div>

      <div>
        <p className="mb-1 text-lg font-bold text-texto" id={`${idBarra}-tema`}>
          Tema
        </p>
        <p className="mb-3 text-base text-texto-suave">«Según el dispositivo» cambia solo cuando tu celular o computador pasa a modo oscuro.</p>
        <GrupoOpciones etiqueta="Tema de la aplicación" opciones={OPCIONES_TEMA} valor={tema.preferencia} onCambio={tema.cambiar} />
      </div>
    </Tarjeta>
  );
}

/* -------------------------------- 2. Guía de usuario -------------------------------- */

function GuiaUsuario({ rol }: { rol: UsuarioAjustes["rol"] }) {
  return (
    <div className="space-y-3">
      {modulosPara(rol).map((m) => (
        <Desplegable key={m.id} titulo={m.nombre}>
          <div className="space-y-3 text-lg text-texto">
            {GUIA_USUARIO[m.id].split(/\n\s*\n/).map((parrafo) => (
              <p key={parrafo}>{parrafo}</p>
            ))}
          </div>
        </Desplegable>
      ))}
    </div>
  );
}

/* ---------------------------- 3. Quejas e inquietudes ---------------------------- */

type Errores = Partial<Record<keyof Queja, string>>;

function FormularioQueja({ usuario }: { usuario: UsuarioAjustes }) {
  const [tipo, setTipo] = useState<Queja["tipo"]>("ERROR");
  const [pantalla, setPantalla] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [errores, setErrores] = useState<Errores>({});

  // Sin datos del desarrollador no hay a dónde enviar: se avisa en vez de fallar al tocar el botón
  const hayWhatsApp = enlaceWhatsAppSoporte(SOPORTE_WHATSAPP, "") !== null;
  const hayCorreo = enlaceCorreoSoporte(SOPORTE_CORREO, "", "") !== null;

  /** Valida y devuelve la queja lista, o null (y muestra los errores). */
  function validar(): Queja | null {
    const resultado = quejaSchema.safeParse({ tipo, pantalla, descripcion });
    if (resultado.success) {
      setErrores({});
      return resultado.data;
    }
    const nuevos: Errores = {};
    for (const problema of resultado.error.issues) {
      const campo = problema.path[0] as keyof Queja;
      nuevos[campo] ??= problema.message;
    }
    setErrores(nuevos);
    return null;
  }

  function mensaje(queja: Queja) {
    return mensajeSoporte(queja, {
      nombre: usuario.nombre,
      rol: usuario.rol,
      local: usuario.localNombre,
      fecha: new Date(),
      agente: navigator.userAgent,
      ancho: window.innerWidth,
      alto: window.innerHeight,
    });
  }

  function enviarWhatsApp() {
    const queja = validar();
    const enlace = queja && enlaceWhatsAppSoporte(SOPORTE_WHATSAPP, mensaje(queja));
    if (enlace) window.open(enlace, "_blank", "noopener");
  }

  function enviarCorreo() {
    const queja = validar();
    const enlace = queja && enlaceCorreoSoporte(SOPORTE_CORREO, asuntoSoporte(queja), mensaje(queja));
    if (enlace) window.location.href = enlace;
  }

  return (
    <Tarjeta>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-5" noValidate>
        <p className="text-lg text-texto-suave">
          Cuéntanos qué pasó. Al enviar, se agregan solos tu nombre, tu local, la fecha, el navegador y el tamaño de la pantalla, para
          encontrar el problema más rápido.
        </p>

        <div>
          <p className="mb-1.5 text-lg font-bold text-texto">¿Qué nos quieres contar?</p>
          <GrupoOpciones etiqueta="Tipo de mensaje" opciones={TIPOS_QUEJA} valor={tipo} onCambio={setTipo} />
        </div>

        <Selector
          etiqueta="¿En qué pantalla pasó?"
          obligatorio
          value={pantalla}
          onChange={(e) => setPantalla(e.target.value)}
          error={errores.pantalla}
        >
          <option value="">Elige una pantalla</option>
          {PANTALLAS_QUEJA.filter((p) => usuario.rol === "ADMIN" || !("soloAdmin" in p)).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Selector>

        <AreaTexto
          etiqueta="Descripción"
          obligatorio
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          error={errores.descripcion}
          ayuda="Mínimo 10 caracteres. Por ejemplo: «Al guardar la factura sale un error y no se descuenta el stock»."
          maxLength={1000}
        />

        {(!hayWhatsApp || !hayCorreo) && (
          <Mensaje tono="alerta">
            {!hayWhatsApp && !hayCorreo
              ? "Aún no están configurados los datos de contacto del desarrollador. Pídele al administrador que los agregue."
              : !hayWhatsApp
                ? "El envío por WhatsApp aún no está configurado: usa el correo."
                : "El envío por correo aún no está configurado: usa WhatsApp."}
          </Mensaje>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Boton variante="exito" icono="mensaje" onClick={enviarWhatsApp} disabled={!hayWhatsApp}>
            Enviar por WhatsApp
          </Boton>
          <Boton variante="secundario" icono="compartir" onClick={enviarCorreo} disabled={!hayCorreo}>
            Enviar por correo
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

/* ------------------------------------- 4. Cuenta ------------------------------------- */

function Cuenta() {
  const [confirmar, setConfirmar] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  return (
    <div className="space-y-4">
      <CambiarMiPassword comoSeccion />
      <Tarjeta className="max-w-2xl">
        <h3 className="mb-2 text-xl font-bold text-texto">Cerrar sesión</h3>
        <p className="mb-4 text-lg text-texto-suave">Sal de tu cuenta en este dispositivo. La factura sin terminar se borra.</p>
        <Boton variante="peligro" icono="salir" onClick={() => setConfirmar(true)}>
          Cerrar sesión
        </Boton>
      </Tarjeta>
      <Confirmar
        abierto={confirmar}
        titulo="¿Cerrar sesión?"
        mensaje="Tendrás que escribir tu identificación y contraseña para volver a entrar."
        textoConfirmar="Cerrar sesión"
        textoCancelar="Seguir conectado"
        peligro
        cargando={saliendo}
        onCerrar={() => setConfirmar(false)}
        onConfirmar={() => {
          setSaliendo(true);
          void cerrarSesion();
        }}
      />
    </div>
  );
}
