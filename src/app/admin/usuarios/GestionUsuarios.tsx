/**
 * Gestión de usuarios (solo administrador):
 *  - Ver todos los vendedores (los que esperan local aparecen primero).
 *  - Asignar o cambiar su local.
 *  - Editar sus datos, cambiar su contraseña, pausar/reactivar su acceso y eliminarlos.
 */
"use client";

import { useState, type FormEvent } from "react";
import { Boton } from "@/components/ui/Boton";
import { GrupoOpciones } from "@/components/ui/GrupoOpciones";
import { Campo, CampoPassword, Selector } from "@/components/ui/Campo";
import { Cargando, EncabezadoPagina, Insignia, Mensaje, Tarjeta, Vacio } from "@/components/ui/Basicos";
import { Confirmar, Modal } from "@/components/ui/Modal";
import { useAvisos } from "@/components/ui/Avisos";
import { ReglasPassword } from "@/components/ui/ReglasPassword";
import { useConsulta } from "@/hooks/useConsulta";
import { useValorDiferido } from "@/hooks/useValorDiferido";
import { fecha } from "@/lib/formato";
import { api } from "@/lib/http";
import { passwordEsValida } from "@/lib/validaciones";
import type { EstadoUsuario } from "@/tipos";

interface Usuario {
  id: string;
  nombre: string;
  identificacion: string;
  correo: string;
  telefono: string;
  estado: EstadoUsuario;
  localId: string | null;
  localNombre: string | null;
  creadoEn: string;
}
interface LocalOpcion {
  id: string;
  nombre: string;
  activo: boolean;
}

type Accion =
  | { tipo: "local"; usuario: Usuario }
  | { tipo: "editar"; usuario: Usuario }
  | { tipo: "password"; usuario: Usuario }
  | { tipo: "estado"; usuario: Usuario }
  | { tipo: "eliminar"; usuario: Usuario };

const FILTROS: { valor: string; texto: string }[] = [
  { valor: "", texto: "Todos" },
  { valor: "PENDIENTE", texto: "En espera de local" },
  { valor: "ACTIVO", texto: "Activos" },
  { valor: "PAUSADO", texto: "En pausa" },
];

const ESTADO_VISUAL: Record<EstadoUsuario, { texto: string; tono: "alerta" | "exito" | "neutro" }> = {
  PENDIENTE: { texto: "Esperando local", tono: "alerta" },
  ACTIVO: { texto: "Activo", tono: "exito" },
  PAUSADO: { texto: "En pausa", tono: "neutro" },
};

export function GestionUsuarios({ estadoInicial }: { estadoInicial: string }) {
  const avisos = useAvisos();
  const [estado, setEstado] = useState(estadoInicial);
  const [texto, setTexto] = useState("");
  const [accion, setAccion] = useState<Accion | null>(null);

  // Búsqueda con una pequeña espera para no consultar con cada letra
  const textoBuscado = useValorDiferido(texto.trim(), 300);
  const params = new URLSearchParams();
  if (estado) params.set("estado", estado);
  if (textoBuscado) params.set("texto", textoBuscado);
  const consulta = useConsulta<{ usuarios: Usuario[] }>(`/api/admin/usuarios?${params}`, { alError: avisos.error });
  const usuarios = consulta.datos?.usuarios ?? (consulta.error ? [] : null);
  const cargar = consulta.recargar;

  const locales = useConsulta<{ locales: LocalOpcion[] }>("/api/admin/locales").datos?.locales ?? [];

  const terminar = (mensaje: string) => {
    avisos.exito(mensaje);
    setAccion(null);
    cargar();
  };

  return (
    <>
      <EncabezadoPagina titulo="Usuarios" descripcion="Asigna locales, edita datos, cambia contraseñas o pausa el acceso." />

      <Tarjeta className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <Campo
            className="lg:flex-1"
            etiqueta="Buscar usuario"
            placeholder="Nombre, identificación o correo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            type="search"
          />
          <GrupoOpciones etiqueta="Filtrar por estado" opciones={FILTROS} valor={estado} onCambio={setEstado} />
        </div>
      </Tarjeta>

      {!usuarios ? (
        <Cargando />
      ) : usuarios.length === 0 ? (
        <Vacio icono="usuarios" titulo="No hay usuarios para mostrar">
          Cuando alguien cree una cuenta, aparecerá aquí para que le asignes un local.
        </Vacio>
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {usuarios.map((u) => (
            <li key={u.id}>
              <Tarjeta className={`h-full ${u.estado === "PENDIENTE" ? "border-alerta-700" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-2xl font-bold">{u.nombre}</h2>
                  <Insignia tono={ESTADO_VISUAL[u.estado].tono}>{ESTADO_VISUAL[u.estado].texto}</Insignia>
                </div>
                <dl className="mt-3 grid gap-x-4 gap-y-1 text-lg sm:grid-cols-2">
                  <div><dt className="inline font-bold">Identificación: </dt><dd className="inline">{u.identificacion}</dd></div>
                  <div><dt className="inline font-bold">Teléfono: </dt><dd className="inline">{u.telefono}</dd></div>
                  <div className="sm:col-span-2 break-all"><dt className="inline font-bold">Correo: </dt><dd className="inline">{u.correo}</dd></div>
                  <div><dt className="inline font-bold">Local: </dt><dd className="inline">{u.localNombre ?? "Sin asignar"}</dd></div>
                  <div><dt className="inline font-bold">Registrado: </dt><dd className="inline">{fecha(u.creadoEn)}</dd></div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Boton pequeno variante={u.localId ? "secundario" : "primario"} icono="local" onClick={() => setAccion({ tipo: "local", usuario: u })}>
                    {u.localId ? "Cambiar local" : "Asignar local"}
                  </Boton>
                  <Boton pequeno variante="secundario" icono="editar" onClick={() => setAccion({ tipo: "editar", usuario: u })}>
                    Editar
                  </Boton>
                  <Boton pequeno variante="secundario" icono="llave" onClick={() => setAccion({ tipo: "password", usuario: u })}>
                    Contraseña
                  </Boton>
                  {u.estado !== "PENDIENTE" && (
                    <Boton
                      pequeno
                      variante="secundario"
                      icono={u.estado === "PAUSADO" ? "play" : "pausa"}
                      onClick={() => setAccion({ tipo: "estado", usuario: u })}
                    >
                      {u.estado === "PAUSADO" ? "Reactivar" : "Pausar"}
                    </Boton>
                  )}
                  <Boton pequeno variante="peligro" icono="basura" onClick={() => setAccion({ tipo: "eliminar", usuario: u })}>
                    Eliminar
                  </Boton>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}

      {accion?.tipo === "local" && (
        <ModalLocal usuario={accion.usuario} locales={locales} onCerrar={() => setAccion(null)} onListo={terminar} />
      )}
      {accion?.tipo === "editar" && <ModalEditar usuario={accion.usuario} onCerrar={() => setAccion(null)} onListo={terminar} />}
      {accion?.tipo === "password" && <ModalPassword usuario={accion.usuario} onCerrar={() => setAccion(null)} onListo={terminar} />}
      {(accion?.tipo === "estado" || accion?.tipo === "eliminar") && (
        <ConfirmarAccion accion={accion} onCerrar={() => setAccion(null)} onListo={terminar} />
      )}
    </>
  );
}

/* ------------------------------ Asignar local ------------------------------ */

function ModalLocal({
  usuario,
  locales,
  onCerrar,
  onListo,
}: {
  usuario: Usuario;
  locales: LocalOpcion[];
  onCerrar: () => void;
  onListo: (m: string) => void;
}) {
  const [localId, setLocalId] = useState(usuario.localId ?? "");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const activos = locales.filter((l) => l.activo);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!localId) return setError("Selecciona un local.");
    setCargando(true);
    try {
      await api(`/api/admin/usuarios/${usuario.id}/local`, { method: "PUT", json: { localId } });
      const nombre = locales.find((l) => l.id === localId)?.nombre;
      onListo(`${usuario.nombre} ahora trabaja en «${nombre}».`);
    } catch (err) {
      setError((err as Error).message);
      setCargando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Local de ${usuario.nombre}`}>
      <form onSubmit={guardar} className="space-y-5">
        {error && <Mensaje tono="peligro">{error}</Mensaje>}
        {activos.length === 0 ? (
          <Mensaje tono="alerta" titulo="No hay locales activos">
            Primero crea un local en la sección «Locales».
          </Mensaje>
        ) : (
          <Selector etiqueta="Selecciona el local" value={localId} onChange={(e) => setLocalId(e.target.value)} obligatorio>
            <option value="">— Elige un local —</option>
            {activos.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </Selector>
        )}
        {usuario.estado === "PENDIENTE" && (
          <p className="text-lg text-texto-suave">Al asignar el local, la cuenta quedará activa y la persona podrá ingresar.</p>
        )}
        <Boton type="submit" ancho cargando={cargando} icono="check" disabled={activos.length === 0}>
          Asignar local
        </Boton>
      </form>
    </Modal>
  );
}

/* ------------------------------- Editar datos ------------------------------ */

function ModalEditar({ usuario, onCerrar, onListo }: { usuario: Usuario; onCerrar: () => void; onListo: (m: string) => void }) {
  const [form, setForm] = useState({
    nombre: usuario.nombre,
    identificacion: usuario.identificacion,
    correo: usuario.correo,
    telefono: usuario.telefono,
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      await api(`/api/admin/usuarios/${usuario.id}`, { method: "PUT", json: form });
      onListo("Datos del usuario actualizados.");
    } catch (err) {
      setError((err as Error).message);
      setCargando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Editar usuario">
      <form onSubmit={guardar} className="space-y-5" noValidate>
        {error && <Mensaje tono="peligro">{error}</Mensaje>}
        <Campo etiqueta="Nombre completo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} obligatorio />
        <Campo
          etiqueta="Identificación"
          inputMode="numeric"
          value={form.identificacion}
          onChange={(e) => setForm({ ...form, identificacion: e.target.value.replace(/\D/g, "") })}
          obligatorio
        />
        <Campo etiqueta="Correo electrónico" type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} obligatorio />
        <Campo etiqueta="Teléfono" type="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} obligatorio />
        <Boton type="submit" ancho cargando={cargando} icono="check">
          Guardar cambios
        </Boton>
      </form>
    </Modal>
  );
}

/* ---------------------------- Cambiar contraseña --------------------------- */

function ModalPassword({ usuario, onCerrar, onListo }: { usuario: Usuario; onCerrar: () => void; onListo: (m: string) => void }) {
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!passwordEsValida(password)) return setError("La contraseña no cumple todos los requisitos.");
    if (password !== confirmar) return setError("Las contraseñas no coinciden.");
    setCargando(true);
    try {
      await api(`/api/admin/usuarios/${usuario.id}/password`, { method: "PUT", json: { password, confirmarPassword: confirmar } });
      onListo(`Contraseña de ${usuario.nombre} cambiada. Su sesión abierta se cerró.`);
    } catch (err) {
      setError((err as Error).message);
      setCargando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Nueva contraseña para ${usuario.nombre}`} tamano="lg">
      <form onSubmit={guardar} className="space-y-5" noValidate>
        {error && <Mensaje tono="peligro">{error}</Mensaje>}
        <CampoPassword etiqueta="Nueva contraseña" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} obligatorio />
        <CampoPassword etiqueta="Repite la contraseña" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} obligatorio />
        <ReglasPassword valor={password} confirmacion={confirmar} />
        <Boton type="submit" ancho cargando={cargando} icono="llave">
          Cambiar contraseña
        </Boton>
      </form>
    </Modal>
  );
}

/* ------------------------- Pausar / reactivar / eliminar ------------------------- */

function ConfirmarAccion({
  accion,
  onCerrar,
  onListo,
}: {
  accion: Extract<Accion, { tipo: "estado" | "eliminar" }>;
  onCerrar: () => void;
  onListo: (m: string) => void;
}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const u = accion.usuario;
  const pausar = u.estado === "ACTIVO";

  async function confirmar() {
    setCargando(true);
    try {
      if (accion.tipo === "eliminar") {
        await api(`/api/admin/usuarios/${u.id}`, { method: "DELETE" });
        onListo(`${u.nombre} fue eliminado.`);
      } else {
        await api(`/api/admin/usuarios/${u.id}/estado`, { method: "PUT", json: { estado: pausar ? "PAUSADO" : "ACTIVO" } });
        onListo(pausar ? `La sesión de ${u.nombre} quedó en pausa.` : `${u.nombre} puede volver a ingresar.`);
      }
    } catch (err) {
      setError((err as Error).message);
      setCargando(false);
    }
  }

  const titulo = accion.tipo === "eliminar" ? "Eliminar usuario" : pausar ? "Pausar acceso" : "Reactivar acceso";
  const mensaje =
    accion.tipo === "eliminar" ? (
      <>
        ¿Seguro que deseas <strong>eliminar a {u.nombre}</strong>? Esta acción no se puede deshacer. Sus facturas se conservan.
      </>
    ) : pausar ? (
      <>
        <strong>{u.nombre}</strong> no podrá ingresar y su sesión abierta se cerrará de inmediato. Podrás reactivarlo cuando quieras.
      </>
    ) : (
      <>
        <strong>{u.nombre}</strong> podrá volver a ingresar al sistema.
      </>
    );

  return (
    <Confirmar
      abierto
      titulo={titulo}
      mensaje={
        <>
          {error && (
            <div className="mb-4">
              <Mensaje tono="peligro">{error}</Mensaje>
            </div>
          )}
          {mensaje}
        </>
      }
      textoConfirmar={accion.tipo === "eliminar" ? "Eliminar usuario" : pausar ? "Pausar usuario" : "Reactivar usuario"}
      peligro={accion.tipo === "eliminar" || pausar}
      cargando={cargando}
      onConfirmar={confirmar}
      onCerrar={onCerrar}
    />
  );
}
