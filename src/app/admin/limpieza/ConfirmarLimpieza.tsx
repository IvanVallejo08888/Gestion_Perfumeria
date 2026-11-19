/**
 * Ventana de confirmación de TODA limpieza (botones rojos). Pasos a prueba de errores:
 *  1. Resumen exacto de lo que se borra y lo que se conserva (vista previa del servidor).
 *  2. Copia de respaldo obligatoria (la casilla no se puede desmarcar): si la descarga falla, no se borra nada.
 *  3. Escribir "BORRAR <NOMBRE DEL LOCAL>".
 *  4. Escribir la contraseña del administrador (el servidor la verifica).
 *  5. Cuenta regresiva de 5 segundos antes de habilitar "Sí, borrar definitivamente".
 */
"use client";

import { useEffect, useState } from "react";
import { Cargando, Mensaje } from "@/components/ui/Basicos";
import { Boton } from "@/components/ui/Boton";
import { Campo, CampoPassword } from "@/components/ui/Campo";
import { Icono } from "@/components/ui/Icono";
import { Modal } from "@/components/ui/Modal";
import { pesos } from "@/lib/formato";
import { api } from "@/lib/http";
import {
  confirmacionCoincide,
  CUENTA_REGRESIVA_SEG,
  hayAlgoQueBorrar,
  textoConfirmacion,
  type AlcanceLimpieza,
  type ConteosLimpieza,
} from "@/lib/limpieza";

export interface SolicitudUI {
  localId: string;
  alcance: AlcanceLimpieza;
  anio?: number;
  meses?: number[];
  /** Título de la ventana: "Borrar todos los gastos". */
  titulo: string;
}

export interface ResultadoLimpieza {
  conteos: ConteosLimpieza;
  valorTotal: number;
  reinicioConsecutivo: boolean;
}

/** Líneas "se borrará" y "se conservará" a partir de los conteos del servidor. */
export function lineasConteos(c: ConteosLimpieza) {
  /** "1 venta" / "3 ventas" (singular y plural correctos). */
  const de = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const borrar: string[] = [];
  const conservar: string[] = [];
  if (c.ventas.cantidad)
    borrar.push(
      `${de(c.ventas.cantidad, "venta de contado", "ventas de contado")} por ${pesos(c.ventas.valor)}${c.ventas.anuladas ? ` (incluye ${de(c.ventas.anuladas, "anulada", "anuladas")})` : ""} y ${de(c.itemsVenta, "línea", "líneas")} de productos`,
    );
  if (c.creditos.cantidad)
    borrar.push(
      `${de(c.creditos.cantidad, "crédito", "créditos")} por ${pesos(c.creditos.valor)}, con ${de(c.cuotas, "cuota", "cuotas")} y ${de(c.abonos.cantidad, "abono", "abonos")} (${pesos(c.abonos.valor)})`,
    );
  if (c.gastos.cantidad)
    borrar.push(`${de(c.gastos.cantidad, "gasto", "gastos")} por ${pesos(c.gastos.valor)}${c.gastos.eliminados ? ` (incluye ${de(c.gastos.eliminados, "eliminado", "eliminados")})` : ""}`);
  if (c.clientes.cantidad) borrar.push(de(c.clientes.cantidad, "cliente", "clientes"));
  if (c.productos.cantidad)
    borrar.push(`${de(c.productos.cantidad, "producto", "productos")} del inventario y ${de(c.productos.movimientos, "movimiento", "movimientos")} de stock`);
  if (c.conservados.creditos || c.conservados.abonos)
    conservar.push(`${de(c.conservados.creditos, "crédito", "créditos")} y ${de(c.conservados.abonos, "abono", "abonos")} de ese periodo (los créditos nunca se tocan aquí)`);
  if (c.clientes.conservados) conservar.push(de(c.clientes.conservados, "cliente", "clientes"));
  return { borrar, conservar };
}

export function ConfirmarLimpieza({
  solicitud,
  localNombre,
  onCerrar,
  onListo,
}: {
  solicitud: SolicitudUI;
  localNombre: string;
  onCerrar: () => void;
  onListo: (r: ResultadoLimpieza) => void;
}) {
  const { titulo, ...datos } = solicitud;
  // 1. Vista previa exacta (la pide el servidor, no se calcula en el navegador)
  const [previa, setPrevia] = useState<ConteosLimpieza | null>(null);
  const [errorPrevia, setErrorPrevia] = useState("");
  useEffect(() => {
    api<{ conteos: ConteosLimpieza }>("/api/admin/limpieza/previa", { method: "POST", json: datos })
      .then((r) => setPrevia(r.conteos))
      .catch((e) => setErrorPrevia((e as Error).message));
    // La solicitud no cambia mientras la ventana está abierta
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [texto, setTexto] = useState("");
  const [password, setPassword] = useState("");
  const [reiniciar, setReiniciar] = useState(false);
  const [paso, setPaso] = useState<"" | "respaldo" | "borrando">("");
  const [error, setError] = useState("");

  // 5. Cuenta regresiva desde que se ve el resumen
  const [segundos, setSegundos] = useState(CUENTA_REGRESIVA_SEG);
  useEffect(() => {
    if (!previa || segundos <= 0) return;
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [previa, segundos]);

  const coincide = confirmacionCoincide(texto, localNombre);
  const listo = !!previa && hayAlgoQueBorrar(previa) && coincide && password.length > 0 && segundos === 0 && !paso;
  const lineas = previa ? lineasConteos(previa) : null;

  async function borrar() {
    setError("");
    // 2. Primero la copia de respaldo. Si falla, NO se borra nada.
    setPaso("respaldo");
    let huella: string;
    try {
      const p = new URLSearchParams({ localId: datos.localId, alcance: datos.alcance });
      if (datos.anio) p.set("anio", String(datos.anio));
      if (datos.meses?.length) p.set("meses", datos.meses.join(","));
      const respuesta = await fetch(`/api/admin/limpieza/respaldo?${p}`, { cache: "no-store" });
      if (!respuesta.ok) throw new Error(((await respuesta.json().catch(() => ({}))) as { error?: string }).error ?? "No se pudo generar la copia de respaldo.");
      huella = respuesta.headers.get("X-Huella-Respaldo") ?? "";
      if (!huella) throw new Error("La copia de respaldo llegó incompleta.");
      const blob = await respuesta.blob();
      const nombre = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(respuesta.headers.get("Content-Disposition") ?? "")?.[1] ?? "Respaldo_limpieza.xlsx");
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombre;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setPaso("");
      setError(`No se borró nada: ${(e as Error).message}`);
      return;
    }

    // 3-4. Ejecutar (el servidor vuelve a verificar todo)
    setPaso("borrando");
    try {
      const resultado = await api<ResultadoLimpieza>("/api/admin/limpieza/ejecutar", {
        method: "POST",
        json: { ...datos, confirmacion: texto, password, huella, reiniciarConsecutivo: datos.alcance === "TODO" && reiniciar },
      });
      onListo(resultado);
    } catch (e) {
      setPaso("");
      setError((e as Error).message);
    }
  }

  return (
    <Modal abierto onCerrar={() => !paso && onCerrar()} titulo={titulo} tamano="lg">
      {errorPrevia ? (
        <Mensaje tono="peligro">{errorPrevia}</Mensaje>
      ) : !previa || !lineas ? (
        <Cargando texto="Revisando qué se va a borrar…" />
      ) : !hayAlgoQueBorrar(previa) ? (
        <Mensaje tono="info" titulo="No hay nada que borrar">
          Este local no tiene registros para esta opción.
        </Mensaje>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border-2 border-peligro-700 bg-peligro-50 p-4 text-lg text-peligro-800">
            <p className="flex items-center gap-2 font-bold">
              <Icono nombre="alerta" className="size-7" />
              Se borrará DEFINITIVAMENTE de «{localNombre}»:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              {lineas.borrar.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            {previa.creditos.conSaldo > 0 && (
              <p className="mt-3 font-bold">
                ⚠ {previa.creditos.conSaldo} créditos todavía tienen saldo: se perderían {pesos(previa.creditos.saldo)} por cobrar.
              </p>
            )}
          </div>
          {lineas.conservar.length > 0 && (
            <div className="rounded-xl border-2 border-exito-700 bg-exito-50 p-4 text-lg text-exito-800">
              <p className="flex items-center gap-2 font-bold">
                <Icono nombre="check" className="size-6" />
                Se conserva:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                {lineas.conservar.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 2. Respaldo obligatorio: la casilla está marcada y no se puede desmarcar */}
          <label className="flex min-h-12 items-start gap-3 rounded-xl border-2 border-linea bg-superficie p-3 text-lg">
            <input type="checkbox" checked disabled aria-describedby="ayuda-respaldo" className="mt-1 size-6 shrink-0 accent-marca-700" />
            <span>
              <strong>Descargar copia de respaldo antes de borrar</strong>
              <span id="ayuda-respaldo" className="block text-base text-texto-suave">
                Obligatorio. Se descarga un Excel con todos los datos que se van a borrar. Si la descarga falla, no se borra nada.
              </span>
            </span>
          </label>

          {solicitud.alcance === "TODO" && (
            <label className="flex min-h-12 items-start gap-3 rounded-xl border-2 border-linea p-3 text-lg">
              <input type="checkbox" checked={reiniciar} onChange={(e) => setReiniciar(e.target.checked)} className="mt-1 size-6 shrink-0 accent-marca-700" />
              <span>
                <strong>Reiniciar numeración de facturas a 1</strong>
                <span className="block text-base text-texto-suave">Al borrar todo no queda ninguna factura, así que la próxima será la N° 000001.</span>
              </span>
            </label>
          )}

          {/* 3. Texto de confirmación */}
          <Campo
            etiqueta={`Para confirmar, escribe: ${textoConfirmacion(localNombre)}`}
            autoComplete="off"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            ayuda={texto && !coincide ? "Todavía no coincide." : "No importan las mayúsculas."}
            obligatorio
          />
          {/* 4. Contraseña del administrador */}
          <CampoPassword etiqueta="Tu contraseña de administrador" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} obligatorio />

          {error && <Mensaje tono="peligro">{error}</Mensaje>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={onCerrar} disabled={!!paso}>
              No, cancelar
            </Boton>
            <Boton variante="peligro" icono="basura" disabled={!listo} cargando={!!paso} onClick={borrar}>
              {segundos > 0 ? `Espera ${segundos} s…` : "Sí, borrar definitivamente"}
            </Boton>
          </div>
          {paso && (
            <p role="status" className="text-lg font-bold">
              {paso === "respaldo" ? "Preparando y descargando la copia de respaldo…" : "Borrando… no cierres esta ventana."}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
