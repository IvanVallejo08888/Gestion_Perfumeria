/**
 * Limpieza del sistema (solo administrador): BORRA DATOS DE FORMA DEFINITIVA.
 *
 * Protecciones (en este orden):
 *  1. Vista previa (dry-run): cuenta lo que se borraría sin tocar nada.
 *  2. Respaldo Excel: se genera en una transacción de SOLO LECTURA (una foto consistente) y entrega
 *     una "huella" firmada con el alcance y las cantidades exactas.
 *  3. Ejecución: exige la contraseña del administrador, el texto "BORRAR <LOCAL>" y la huella del
 *     respaldo. Dentro de UNA transacción: bloquea el local (FOR UPDATE), rechaza si hubo otra limpieza
 *     hace menos de 30 s, vuelve a contar y, si algo cambió desde el respaldo, NO borra nada.
 *     Borra en orden (facturas → deudas → gastos → clientes → productos) y escribe el registro de auditoría
 *     en la misma transacción. Si algo falla, PostgreSQL revierte todo.
 *
 * Mapa de dependencias (ver README): facturas.cliente_id es RESTRICT → las facturas se borran antes
 * que los clientes. Ítems, cuotas y abonos caen en cascada con su factura; los movimientos de
 * inventario caen en cascada con su producto. Nunca se tocan: el local, usuarios, sectores, marcas,
 * categorías de gasto, proveedores, compras a proveedores ni el historial de limpiezas.
 *
 * Deudas (gastos a crédito): deudas.gasto_id es RESTRICT → las deudas se borran ANTES que los gastos;
 * sus cuotas y pagos caen en cascada con la deuda. Igual que los créditos de clientes, la limpieza por
 * periodo y «Todos los gastos» CONSERVAN las deudas, sus pagos y sus gastos de origen (medio CREDITO):
 * solo se borran con «Todas las deudas» o «Todo el local».
 */
import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { and, asc, count, desc, eq, getTableColumns, gt, gte, inArray, lt, ne, notExists, or, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, type Transaccion } from "@/db";
import {
  abonos,
  clientes,
  cuotas,
  deudaCuotas,
  deudaPagos,
  deudas,
  facturaItems,
  facturas,
  gastos,
  limpiezas,
  locales,
  marcas,
  movimientosInventario,
  productos,
  usuarios,
} from "@/db/schema";
import { ApiError } from "@/lib/api";
import type { UsuarioSesion } from "@/lib/auth/sesion";
import { fechaHora } from "@/lib/formato";
import {
  confirmacionCoincide,
  describirPeriodo,
  ESPERA_ENTRE_LIMPIEZAS_SEG,
  ETIQUETA_ALCANCE,
  mesesFuturos,
  normalizarMeses,
  rangosDelPeriodo,
  type AlcanceLimpieza,
  type ConteosLimpieza,
} from "@/lib/limpieza";
import { aArchivo, estilizarEncabezado, nombreSeguro, nota, nuevoLibro } from "./reportes-excel";

export interface SolicitudLimpieza {
  localId: string;
  alcance: AlcanceLimpieza;
  anio?: number;
  meses?: number[];
}

type Conexion = typeof db | Transaccion;

/* ------------------------------- Validación ------------------------------- */

/** Revisa el periodo (año obligatorio en PERIODO, sin meses futuros) y deja los meses ordenados. */
function prepararSolicitud(s: SolicitudLimpieza): Required<SolicitudLimpieza> {
  if (s.alcance !== "PERIODO") return { ...s, anio: 0, meses: [] };
  if (!s.anio) throw new ApiError(400, "Elige el año del periodo.");
  const meses = normalizarMeses(s.meses);
  const futuros = mesesFuturos(s.anio, meses);
  if (futuros.length) throw new ApiError(400, "No se puede limpiar un periodo que todavía no ha llegado. Elige meses ya terminados o el mes actual.");
  return { ...s, anio: s.anio, meses };
}

async function obtenerLocalOError(cx: Conexion, localId: string) {
  const [local] = await cx.select().from(locales).where(eq(locales.id, localId));
  if (!local) throw new ApiError(404, "El local no existe.");
  return local;
}

/* ----------------------------- Qué se borra ----------------------------- */

/**
 * Condiciones de borrado de cada tabla según el alcance (null = esa tabla no se toca).
 * Las mismas condiciones las usan la vista previa, el respaldo y la ejecución:
 * así lo que se cuenta, lo que se respalda y lo que se borra es siempre lo mismo.
 */
function condiciones(s: Required<SolicitudLimpieza>) {
  const delLocal = eq(facturas.localId, s.localId);
  const sinFacturas = notExists(db.select({ id: facturas.id }).from(facturas).where(eq(facturas.clienteId, clientes.id)));

  let facturasCond: SQL | null = null;
  let gastosCond: SQL | null = null;
  let deudasCond: SQL | null = null;
  let clientesCond: SQL | null = null;
  let productosCond: SQL | null = null;
  // Gastos de contado (los de medio CREDITO son el origen de una deuda: se conservan con ella)
  const deContado = ne(gastos.medioPago, "CREDITO");

  switch (s.alcance) {
    case "PERIODO": {
      const { instantes, dias } = rangosDelPeriodo(s.anio, s.meses);
      // SOLO ventas de contado del periodo (también las anuladas); los créditos nunca
      facturasCond = and(
        delLocal,
        eq(facturas.tipo, "NORMAL"),
        or(...instantes.map((r) => and(gte(facturas.creadoEn, r.inicio), lt(facturas.creadoEn, r.fin))!)),
      )!;
      // SOLO gastos de contado del periodo: las deudas, sus pagos y sus gastos de origen se conservan
      gastosCond = and(eq(gastos.localId, s.localId), deContado, or(...dias.map((d) => and(gte(gastos.fecha, d.desde), lt(gastos.fecha, d.hasta))!)))!;
      break;
    }
    case "VENTAS":
      facturasCond = and(delLocal, eq(facturas.tipo, "NORMAL"))!;
      break;
    case "CREDITOS":
      facturasCond = and(delLocal, eq(facturas.tipo, "CREDITO"))!;
      break;
    case "GASTOS":
      // Todos los gastos de contado; los de origen de una deuda solo se borran con «Todas las deudas»
      gastosCond = and(eq(gastos.localId, s.localId), deContado)!;
      break;
    case "DEUDAS":
      // Todas las deudas (con sus cuotas y pagos, en cascada) y sus gastos de origen (medio CREDITO)
      deudasCond = eq(deudas.localId, s.localId);
      gastosCond = and(eq(gastos.localId, s.localId), eq(gastos.medioPago, "CREDITO"))!;
      break;
    case "CLIENTES":
      // Solo los que no tienen ninguna factura (venta o crédito): los demás se conservan
      clientesCond = and(eq(clientes.localId, s.localId), sinFacturas)!;
      break;
    case "INVENTARIO":
      productosCond = eq(productos.localId, s.localId);
      break;
    case "TODO":
      // Al borrar primero todas las facturas, ningún cliente del local queda con facturas
      facturasCond = delLocal;
      deudasCond = eq(deudas.localId, s.localId);
      gastosCond = eq(gastos.localId, s.localId);
      clientesCond = eq(clientes.localId, s.localId);
      productosCond = eq(productos.localId, s.localId);
      break;
  }
  return { facturasCond, gastosCond, deudasCond, clientesCond, productosCond };
}

const n = (v: unknown) => Number(v ?? 0);

/** Cuenta lo que se borraría (y lo que se conserva). No modifica nada. */
async function contar(cx: Conexion, s: Required<SolicitudLimpieza>): Promise<ConteosLimpieza> {
  const { facturasCond, gastosCond, deudasCond, clientesCond, productosCond } = condiciones(s);
  const vigente = sql`not ${facturas.anulada}`;
  const ventasCond = facturasCond && and(facturasCond, eq(facturas.tipo, "NORMAL"));
  const creditosCond = facturasCond && and(facturasCond, eq(facturas.tipo, "CREDITO"));

  const [ventas] = ventasCond
    ? await cx
        .select({
          cantidad: count(),
          valor: sql`coalesce(sum(${facturas.total}) filter (where ${vigente}), 0)`,
          anuladas: sql`count(*) filter (where ${facturas.anulada})`,
        })
        .from(facturas)
        .where(ventasCond)
    : [{ cantidad: 0, valor: 0, anuladas: 0 }];
  const [items] = ventasCond
    ? await cx.select({ n: count() }).from(facturaItems).innerJoin(facturas, eq(facturaItems.facturaId, facturas.id)).where(ventasCond)
    : [{ n: 0 }];
  const [creditos] = creditosCond
    ? await cx
        .select({
          cantidad: count(),
          valor: sql`coalesce(sum(${facturas.total}) filter (where ${vigente}), 0)`,
          conSaldo: sql`count(*) filter (where ${vigente} and ${facturas.estado} = 'PENDIENTE')`,
          saldo: sql`coalesce(sum(${facturas.saldo}) filter (where ${vigente} and ${facturas.estado} = 'PENDIENTE'), 0)`,
        })
        .from(facturas)
        .where(creditosCond)
    : [{ cantidad: 0, valor: 0, conSaldo: 0, saldo: 0 }];
  const [nCuotas] = creditosCond
    ? await cx.select({ n: count() }).from(cuotas).innerJoin(facturas, eq(cuotas.facturaId, facturas.id)).where(creditosCond)
    : [{ n: 0 }];
  const [nAbonos] = creditosCond
    ? await cx
        .select({ cantidad: count(), valor: sql`coalesce(sum(${abonos.valor}) filter (where not ${abonos.anulado}), 0)` })
        .from(abonos)
        .innerJoin(facturas, eq(abonos.facturaId, facturas.id))
        .where(creditosCond)
    : [{ cantidad: 0, valor: 0 }];
  const [nGastos] = gastosCond
    ? await cx
        .select({
          cantidad: count(),
          valor: sql`coalesce(sum(${gastos.valor}) filter (where not ${gastos.anulado}), 0)`,
          eliminados: sql`count(*) filter (where ${gastos.anulado})`,
        })
        .from(gastos)
        .where(gastosCond)
    : [{ cantidad: 0, valor: 0, eliminados: 0 }];
  const [nDeudas] = deudasCond
    ? await cx
        .select({
          cantidad: count(),
          valor: sql`coalesce(sum(${deudas.valorTotal}) filter (where ${deudas.estado} <> 'ANULADA'), 0)`,
          conSaldo: sql`count(*) filter (where ${deudas.estado} = 'PENDIENTE')`,
          saldo: sql`coalesce(sum(${deudas.saldo}) filter (where ${deudas.estado} = 'PENDIENTE'), 0)`,
        })
        .from(deudas)
        .where(deudasCond)
    : [{ cantidad: 0, valor: 0, conSaldo: 0, saldo: 0 }];
  const [nCuotasDeuda] = deudasCond
    ? await cx.select({ n: count() }).from(deudaCuotas).innerJoin(deudas, eq(deudaCuotas.deudaId, deudas.id)).where(deudasCond)
    : [{ n: 0 }];
  const [nPagosDeuda] = deudasCond
    ? await cx
        .select({ cantidad: count(), valor: sql`coalesce(sum(${deudaPagos.valor}) filter (where not ${deudaPagos.anulado}), 0)` })
        .from(deudaPagos)
        .innerJoin(deudas, eq(deudaPagos.deudaId, deudas.id))
        .where(deudasCond)
    : [{ cantidad: 0, valor: 0 }];
  const [totalClientes] = await cx.select({ n: count() }).from(clientes).where(eq(clientes.localId, s.localId));
  const [nClientes] = clientesCond ? await cx.select({ n: count() }).from(clientes).where(clientesCond) : [{ n: 0 }];
  const [nProductos] = productosCond ? await cx.select({ n: count() }).from(productos).where(productosCond) : [{ n: 0 }];
  const [nMovimientos] = productosCond
    ? await cx
        .select({ n: count() })
        .from(movimientosInventario)
        .innerJoin(productos, eq(movimientosInventario.productoId, productos.id))
        .where(productosCond)
    : [{ n: 0 }];

  // Lo que se CONSERVA aunque sea del periodo: créditos creados y abonos recibidos en esos meses,
  // deudas adquiridas y pagos de deudas hechos en esos meses
  let conservados = { creditos: 0, abonos: 0, deudas: 0, pagosDeuda: 0 };
  if (s.alcance === "PERIODO") {
    const { instantes, dias } = rangosDelPeriodo(s.anio, s.meses);
    const enPeriodo = (col: typeof facturas.creadoEn | typeof abonos.creadoEn) => or(...instantes.map((r) => and(gte(col, r.inicio), lt(col, r.fin))!));
    const [c] = await cx.select({ n: count() }).from(facturas).where(and(eq(facturas.localId, s.localId), eq(facturas.tipo, "CREDITO"), enPeriodo(facturas.creadoEn)));
    const [a] = await cx
      .select({ n: count() })
      .from(abonos)
      .innerJoin(facturas, eq(abonos.facturaId, facturas.id))
      .where(and(eq(facturas.localId, s.localId), enPeriodo(abonos.creadoEn)));
    const [dd] = await cx
      .select({ n: count() })
      .from(deudas)
      .innerJoin(gastos, eq(deudas.gastoId, gastos.id))
      .where(and(eq(deudas.localId, s.localId), or(...dias.map((d) => and(gte(gastos.fecha, d.desde), lt(gastos.fecha, d.hasta))!))));
    const [pd] = await cx
      .select({ n: count() })
      .from(deudaPagos)
      .where(and(eq(deudaPagos.localId, s.localId), or(...instantes.map((r) => and(gte(deudaPagos.fecha, r.inicio), lt(deudaPagos.fecha, r.fin))!))));
    conservados = { creditos: n(c.n), abonos: n(a.n), deudas: n(dd.n), pagosDeuda: n(pd.n) };
  }

  return {
    ventas: { cantidad: n(ventas.cantidad), valor: n(ventas.valor), anuladas: n(ventas.anuladas) },
    itemsVenta: n(items.n),
    creditos: { cantidad: n(creditos.cantidad), valor: n(creditos.valor), conSaldo: n(creditos.conSaldo), saldo: n(creditos.saldo) },
    cuotas: n(nCuotas.n),
    abonos: { cantidad: n(nAbonos.cantidad), valor: n(nAbonos.valor) },
    gastos: { cantidad: n(nGastos.cantidad), valor: n(nGastos.valor), eliminados: n(nGastos.eliminados) },
    clientes: { cantidad: n(nClientes.n), conservados: n(totalClientes.n) - n(nClientes.n) },
    productos: { cantidad: n(nProductos.n), movimientos: n(nMovimientos.n) },
    deudas: { cantidad: n(nDeudas.cantidad), valor: n(nDeudas.valor), conSaldo: n(nDeudas.conSaldo), saldo: n(nDeudas.saldo) },
    cuotasDeuda: n(nCuotasDeuda.n),
    pagosDeuda: { cantidad: n(nPagosDeuda.cantidad), valor: n(nPagosDeuda.valor) },
    conservados,
  };
}

/* ------------------------------ Consultas ------------------------------ */

/** Lo que el local tiene hoy (resumen de la pantalla). */
export async function resumenLocal(localId: string) {
  const local = await obtenerLocalOError(db, localId);
  const [f] = await db
    .select({
      ventasContado: sql`count(*) filter (where ${facturas.tipo} = 'NORMAL')`,
      creditosPendientes: sql`count(*) filter (where ${facturas.tipo} = 'CREDITO' and ${facturas.estado} = 'PENDIENTE' and not ${facturas.anulada})`,
      creditosCompletados: sql`count(*) filter (where ${facturas.tipo} = 'CREDITO' and (${facturas.estado} = 'COMPLETADA' or ${facturas.anulada}))`,
      primeraVenta: sql<string | null>`min(${facturas.creadoEn})::text`,
      ultimaVenta: sql<string | null>`max(${facturas.creadoEn})::text`,
    })
    .from(facturas)
    .where(eq(facturas.localId, localId));
  const [a] = await db.select({ n: count() }).from(abonos).innerJoin(facturas, eq(abonos.facturaId, facturas.id)).where(eq(facturas.localId, localId));
  const [c] = await db
    .select({
      total: count(),
      conFacturas: sql`count(*) filter (where exists (select 1 from ${facturas} where ${facturas.clienteId} = ${clientes.id}))`,
    })
    .from(clientes)
    .where(eq(clientes.localId, localId));
  const [p] = await db.select({ n: count() }).from(productos).where(eq(productos.localId, localId));
  // Gastos de contado (los de origen de una deuda se cuentan con las deudas)
  const [g] = await db.select({ n: count() }).from(gastos).where(and(eq(gastos.localId, localId), ne(gastos.medioPago, "CREDITO")));
  const [d] = await db
    .select({
      total: count(),
      pendientes: sql`count(*) filter (where ${deudas.estado} = 'PENDIENTE')`,
      saldo: sql`coalesce(sum(${deudas.saldo}) filter (where ${deudas.estado} = 'PENDIENTE'), 0)`,
    })
    .from(deudas)
    .where(eq(deudas.localId, localId));
  const iso = (v: string | null) => (v ? new Date(v).toISOString() : null);
  return {
    local: { id: local.id, nombre: local.nombre, activo: local.activo, consecutivoFactura: local.consecutivoFactura },
    ventasContado: n(f.ventasContado),
    creditosPendientes: n(f.creditosPendientes),
    creditosCompletados: n(f.creditosCompletados),
    abonos: n(a.n),
    clientes: n(c.total),
    clientesConFacturas: n(c.conFacturas),
    productos: n(p.n),
    gastos: n(g.n),
    deudas: n(d.total),
    deudasPendientes: n(d.pendientes),
    saldoDeudas: n(d.saldo),
    primeraVenta: iso(f.primeraVenta),
    ultimaVenta: iso(f.ultimaVenta),
  };
}

export type ResumenLocal = Awaited<ReturnType<typeof resumenLocal>>;

/** Vista previa (dry-run): NO modifica nada. */
export async function vistaPrevia(solicitud: SolicitudLimpieza) {
  const s = prepararSolicitud(solicitud);
  const local = await obtenerLocalOError(db, s.localId);
  return { local: { id: local.id, nombre: local.nombre }, conteos: await contar(db, s) };
}

/** Historial de limpiezas (más reciente primero). Sin localId: todos los locales. */
export async function historialLimpiezas(localId?: string) {
  const filas = await db
    .select()
    .from(limpiezas)
    .where(localId ? eq(limpiezas.localId, localId) : undefined)
    .orderBy(desc(limpiezas.creadoEn))
    .limit(50);
  return filas.map((l) => ({
    id: l.id,
    localNombre: l.localNombre,
    adminNombre: l.adminNombre,
    alcance: l.alcance,
    descripcion: l.alcance === "PERIODO" && l.anio ? describirPeriodo(l.anio, l.meses ?? []) : ETIQUETA_ALCANCE[l.alcance],
    conteos: l.conteos,
    valorTotal: l.valorTotal,
    reinicioConsecutivo: l.reinicioConsecutivo,
    creadoEn: l.creadoEn.toISOString(),
  }));
}

/* ------------------------------ Huella ------------------------------ */

/** Minutos que dura válida la huella de un respaldo. */
const VIGENCIA_HUELLA_MIN = 15;

function secreto() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET no está configurado.");
  return s;
}

const firmar = (texto: string) => crypto.createHmac("sha256", secreto()).update(`limpieza:${texto}`).digest("base64url");

/** Huella del respaldo: alcance + cantidades exactas, firmada para que el navegador no la pueda alterar. */
function crearHuella(s: Required<SolicitudLimpieza>, conteos: ConteosLimpieza): string {
  const datos = Buffer.from(
    JSON.stringify({ localId: s.localId, alcance: s.alcance, anio: s.anio, meses: s.meses, conteos, vence: Date.now() + VIGENCIA_HUELLA_MIN * 60_000 }),
  ).toString("base64url");
  return `${datos}.${firmar(datos)}`;
}

function leerHuella(huella: string, s: Required<SolicitudLimpieza>): ConteosLimpieza {
  const [datos, firma] = huella.split(".");
  const esperada = datos ? firmar(datos) : "";
  if (!datos || !firma || firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) {
    throw new ApiError(400, "Primero se debe descargar la copia de respaldo.");
  }
  const h = JSON.parse(Buffer.from(datos, "base64url").toString()) as {
    localId: string;
    alcance: string;
    anio: number;
    meses: number[];
    conteos: ConteosLimpieza;
    vence: number;
  };
  if (h.vence < Date.now()) throw new ApiError(400, "La copia de respaldo venció (más de 15 minutos). Vuelve a abrir la confirmación.");
  if (h.localId !== s.localId || h.alcance !== s.alcance || h.anio !== s.anio || JSON.stringify(h.meses) !== JSON.stringify(s.meses)) {
    throw new ApiError(400, "La copia de respaldo no corresponde a esta limpieza. Vuelve a abrir la confirmación.");
  }
  return h.conteos;
}

/* ------------------------------ Respaldo ------------------------------ */

/** "clienteNombre" → "Cliente nombre" (encabezados legibles en el respaldo). */
function encabezado(clave: string): string {
  const texto = clave.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Una hoja por tabla, con TODAS sus columnas (aunque no tenga filas).
 * extras: columnas adicionales que no están en la tabla (por ejemplo, el nombre de la marca).
 */
function hojaDeTabla(libro: ExcelJS.Workbook, nombre: string, tabla: PgTable, filas: Record<string, unknown>[], extras: string[] = []) {
  const claves = [...Object.keys(getTableColumns(tabla)), ...extras];
  const hoja = libro.addWorksheet(nombre);
  hoja.columns = claves.map((k) => ({ header: encabezado(k), key: k, width: Math.min(40, Math.max(12, encabezado(k).length + 4)) }));
  hoja.addRows(
    filas.map((f) =>
      Object.fromEntries(
        claves.map((k) => {
          const v = f[k];
          // Arreglos y objetos como texto; fechas y números tal cual
          return [k, v === null || v === undefined ? "" : typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v];
        }),
      ),
    ),
  );
  estilizarEncabezado(hoja);
  if (filas.length === 0) nota(hoja, "Sin registros en esta tabla.");
}

/**
 * Copia de respaldo en Excel con EXACTAMENTE los registros que borraría la limpieza.
 * Se lee dentro de una transacción de solo lectura (repeatable read): conteos y filas son la misma foto.
 * Devuelve también la huella que exige la ejecución.
 */
export async function generarRespaldo(solicitud: SolicitudLimpieza, admin: { nombre: string }) {
  const s = prepararSolicitud(solicitud);
  return db.transaction(
    async (tx) => {
      const local = await obtenerLocalOError(tx, s.localId);
      const conteos = await contar(tx, s);
      const { facturasCond, gastosCond, deudasCond, clientesCond, productosCond } = condiciones(s);
      const libro = nuevoLibro();

      /* Hoja de resumen */
      const resumen = libro.addWorksheet("Resumen");
      resumen.columns = [
        { header: "Dato", key: "dato", width: 34 },
        { header: "Valor", key: "valor", width: 50 },
      ];
      resumen.addRows([
        { dato: "Local", valor: local.nombre },
        { dato: "Qué se borra", valor: s.alcance === "PERIODO" ? `${ETIQUETA_ALCANCE.PERIODO}: ${describirPeriodo(s.anio, s.meses)}` : ETIQUETA_ALCANCE[s.alcance] },
        { dato: "Copia generada", valor: fechaHora(new Date()) },
        { dato: "Administrador", valor: admin.nombre },
        { dato: "Ventas de contado", valor: conteos.ventas.cantidad },
        { dato: "Productos vendidos (líneas)", valor: conteos.itemsVenta },
        { dato: "Créditos", valor: conteos.creditos.cantidad },
        { dato: "Cuotas", valor: conteos.cuotas },
        { dato: "Abonos", valor: conteos.abonos.cantidad },
        { dato: "Gastos", valor: conteos.gastos.cantidad },
        { dato: "Deudas", valor: conteos.deudas?.cantidad ?? 0 },
        { dato: "Cuotas de deudas", valor: conteos.cuotasDeuda ?? 0 },
        { dato: "Pagos de deudas", valor: conteos.pagosDeuda?.cantidad ?? 0 },
        { dato: "Saldo de deudas pendientes que se pierde", valor: conteos.deudas?.saldo ?? 0 },
        { dato: "Clientes", valor: conteos.clientes.cantidad },
        { dato: "Productos del inventario", valor: conteos.productos.cantidad },
        { dato: "Movimientos de inventario", valor: conteos.productos.movimientos },
      ]);
      estilizarEncabezado(resumen);
      nota(resumen, "Copia de respaldo de los datos que se borraron con «Limpieza del sistema». Cada hoja es una tabla de la base de datos.");

      /* Facturas y lo que depende de ellas (ítems, cuotas, abonos) */
      if (facturasCond) {
        const lista = await tx.select().from(facturas).where(facturasCond).orderBy(asc(facturas.creadoEn));
        const ids = lista.map((f) => f.id);
        const porIds = <T>(consulta: (ids: string[]) => Promise<T[]>) => (ids.length ? consulta(ids) : Promise.resolve([] as T[]));
        hojaDeTabla(libro, "Facturas", facturas, lista);
        hojaDeTabla(libro, "Productos vendidos", facturaItems, await porIds((i) => tx.select().from(facturaItems).where(inArray(facturaItems.facturaId, i))));
        if (s.alcance === "CREDITOS" || s.alcance === "TODO") {
          hojaDeTabla(libro, "Cuotas", cuotas, await porIds((i) => tx.select().from(cuotas).where(inArray(cuotas.facturaId, i)).orderBy(asc(cuotas.numero))));
          hojaDeTabla(libro, "Abonos", abonos, await porIds((i) => tx.select().from(abonos).where(inArray(abonos.facturaId, i)).orderBy(asc(abonos.creadoEn))));
        }
      }
      /* Deudas y lo que depende de ellas (cuotas y pagos, también los anulados) */
      if (deudasCond) {
        const lista = await tx.select().from(deudas).where(deudasCond).orderBy(asc(deudas.creadoEn));
        const ids = lista.map((x) => x.id);
        hojaDeTabla(libro, "Deudas", deudas, lista);
        hojaDeTabla(libro, "Cuotas de deudas", deudaCuotas, ids.length ? await tx.select().from(deudaCuotas).where(inArray(deudaCuotas.deudaId, ids)).orderBy(asc(deudaCuotas.deudaId), asc(deudaCuotas.numero)) : []);
        hojaDeTabla(libro, "Pagos de deudas", deudaPagos, ids.length ? await tx.select().from(deudaPagos).where(inArray(deudaPagos.deudaId, ids)).orderBy(asc(deudaPagos.fecha)) : []);
      }
      if (gastosCond) hojaDeTabla(libro, "Gastos", gastos, await tx.select().from(gastos).where(gastosCond).orderBy(asc(gastos.fecha)));
      if (clientesCond) hojaDeTabla(libro, "Clientes", clientes, await tx.select().from(clientes).where(clientesCond).orderBy(asc(clientes.nombre)));
      if (productosCond) {
        // El inventario lleva también el nombre de la marca (la tabla solo guarda su id)
        const lista = await tx
          .select({ ...getTableColumns(productos), marcaNombre: marcas.nombre })
          .from(productos)
          .leftJoin(marcas, eq(marcas.id, productos.marcaId))
          .where(productosCond)
          .orderBy(asc(productos.nombreCompleto));
        hojaDeTabla(libro, "Inventario", productos, lista, ["marcaNombre"]);
        hojaDeTabla(
          libro,
          "Movimientos de inventario",
          movimientosInventario,
          await tx
            .select(getTableColumns(movimientosInventario))
            .from(movimientosInventario)
            .innerJoin(productos, eq(movimientosInventario.productoId, productos.id))
            .where(productosCond)
            .orderBy(asc(movimientosInventario.creadoEn)),
        );
      }

      const archivo = await aArchivo(
        libro,
        `Respaldo_limpieza_${nombreSeguro(local.nombre)}_${s.alcance}_${new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })}.xlsx`,
      );
      return { ...archivo, huella: crearHuella(s, conteos), conteos };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

/* ------------------------------ Ejecución ------------------------------ */

export interface DatosEjecucion extends SolicitudLimpieza {
  confirmacion: string;
  password: string;
  huella: string;
  reiniciarConsecutivo?: boolean;
}

/** Borra según el alcance. Ver las protecciones al inicio del archivo. */
export async function ejecutarLimpieza(admin: UsuarioSesion, datos: DatosEjecucion) {
  const s = prepararSolicitud(datos);

  // 1. Contraseña del administrador (bcrypt, contra la base de datos)
  const [cuenta] = await db.select({ hash: usuarios.passwordHash }).from(usuarios).where(eq(usuarios.id, admin.id));
  if (!cuenta || !(await bcrypt.compare(datos.password, cuenta.hash))) {
    // 400 (no 401): un 401 cerraría la sesión del administrador
    throw new ApiError(400, "La contraseña no es correcta. No se borró nada.");
  }

  // 2. La huella del respaldo debe corresponder a esta misma limpieza
  const conteosRespaldo = leerHuella(datos.huella, s);

  if (datos.reiniciarConsecutivo && s.alcance !== "TODO") {
    throw new ApiError(400, "Solo se puede reiniciar la numeración al borrar todo el local.");
  }

  return db.transaction(async (tx) => {
    // 3. Bloquea el local: otra limpieza o una factura nueva del mismo local esperan a que esto termine
    const [local] = await tx.select().from(locales).where(eq(locales.id, s.localId)).for("update");
    if (!local) throw new ApiError(404, "El local no existe.");
    if (!confirmacionCoincide(datos.confirmacion, local.nombre)) {
      throw new ApiError(400, `Escribe exactamente «BORRAR ${local.nombre}» para confirmar. No se borró nada.`);
    }

    // 4. Máximo una limpieza por local cada 30 segundos (doble clic, reintentos, dos pestañas)
    const [reciente] = await tx
      .select({ id: limpiezas.id })
      .from(limpiezas)
      .where(and(eq(limpiezas.localId, s.localId), gt(limpiezas.creadoEn, sql`now() - make_interval(secs => ${ESPERA_ENTRE_LIMPIEZAS_SEG})`)))
      .limit(1);
    if (reciente) throw new ApiError(429, `Ya se hizo una limpieza de este local hace menos de ${ESPERA_ENTRE_LIMPIEZAS_SEG} segundos. Espera un momento.`);

    // 5. Lo que se va a borrar debe ser EXACTAMENTE lo que está en el respaldo descargado
    const conteos = await contar(tx, s);
    if (JSON.stringify(conteos) !== JSON.stringify(conteosRespaldo)) {
      throw new ApiError(409, "Los datos cambiaron desde que se descargó la copia de respaldo (por ejemplo, alguien registró una venta). No se borró nada: vuelve a revisar y confirma de nuevo.");
    }

    // 6. Borrado en orden: facturas (con ítems, cuotas y abonos en cascada) → deudas (con cuotas y pagos en
    //    cascada; antes que los gastos, por la FK RESTRICT) → gastos → clientes → productos
    const { facturasCond, gastosCond, deudasCond, clientesCond, productosCond } = condiciones(s);
    if (facturasCond) await tx.delete(facturas).where(facturasCond);
    if (deudasCond) await tx.delete(deudas).where(deudasCond);
    if (gastosCond) await tx.delete(gastos).where(gastosCond);
    if (clientesCond) await tx.delete(clientes).where(clientesCond);
    if (productosCond) await tx.delete(productos).where(productosCond);

    // 7. Reiniciar la numeración: solo si de verdad no queda ninguna factura en el local
    if (datos.reiniciarConsecutivo) {
      const [restantes] = await tx.select({ n: count() }).from(facturas).where(eq(facturas.localId, s.localId));
      if (n(restantes.n) > 0) throw new ApiError(409, "Todavía quedan facturas en el local: no se puede reiniciar la numeración. No se borró nada.");
      await tx.update(locales).set({ consecutivoFactura: 0 }).where(eq(locales.id, s.localId));
    }

    // Solo para pruebas: provoca un error a mitad de la transacción para comprobar que todo se revierte
    if (process.env.LIMPIEZA_SIMULAR_FALLO === "1") throw new Error("Fallo simulado de la limpieza (LIMPIEZA_SIMULAR_FALLO=1).");

    // 8. Auditoría, en la misma transacción
    const valorTotal = conteos.ventas.valor + conteos.creditos.valor + conteos.gastos.valor;
    await tx.insert(limpiezas).values({
      localId: s.localId,
      localNombre: local.nombre,
      adminId: admin.id,
      adminNombre: admin.nombre,
      alcance: s.alcance,
      anio: s.alcance === "PERIODO" ? s.anio : null,
      meses: s.alcance === "PERIODO" ? s.meses : null,
      conteos,
      valorTotal,
      reinicioConsecutivo: !!datos.reiniciarConsecutivo,
    });

    return { conteos, valorTotal, reinicioConsecutivo: !!datos.reiniciarConsecutivo };
  });
}
