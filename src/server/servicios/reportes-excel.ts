/**
 * Generación de reportes en Excel (.xlsx).
 *
 * Reporte POR LOCAL (anual o mensual):
 *  - Resumen, Facturas, Productos vendidos, Ventas por categoría, Abonos, Ventas por vendedor, Gastos y Gastos personales → datos del periodo elegido.
 *  - Cartera e Inventario → foto del momento en que se genera (lo que se debe y lo que hay hoy).
 *  - Deudas (las adquiridas en el periodo + las pendientes hoy), Pagos de deudas y Caja diaria.
 *
 * Regla de las deudas (gastos a crédito): los gastos del periodo = gastos de contado + pagos de deudas del
 * periodo. En la hoja «Gastos» un gasto a crédito aparece con medio «Crédito» pero NO suma en su total.
 *
 * Reporte CONSOLIDADO (solo administrador): todos los locales comparados + ventas por categoría + cartera de todos los locales.
 *
 * "Ventas por categoría" usa los mismos cortes del dashboard (ver dashboard.ts).
 *
 * Lo anulado NO aparece en esas hojas ni en sus totales (tampoco en Cartera ni en el consolidado).
 * Va aparte, en las hojas "Ventas anuladas" y "Gastos eliminados" (por la fecha de la venta o del gasto).
 */
import "server-only";
import ExcelJS from "exceljs";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { abonos, cuotas, facturaItems, facturas, locales, marcas, productos } from "@/db/schema";
import { ETIQUETA_CATEGORIA, ETIQUETA_CONCENTRACION, ETIQUETA_GENERO } from "@/lib/clasificacion";
import { cajaPorDia } from "@/lib/caja";
import { estaVencida, textoFormaPagoFinal, TEXTO_ESTADO_DEUDA } from "@/lib/deudas";
import { fecha, fechaDia, fechaHora, MESES, numeroFactura, rangoDias, rangoPeriodo } from "@/lib/formato";
import { textoMedioPago, textoMedioPagoGasto } from "@/lib/pagos";
import { movimientosCaja } from "./caja";
import { deudasParaReporte, pagosDeudasParaReporte } from "./deudas";
import { ventasPorCategoria, type VentasPorCategoria } from "./dashboard";
import { obtenerEstadisticas } from "./estadisticas";
import { gastosDelPeriodo } from "./gastos";
import { listarLocales, obtenerLocal } from "./locales";

export const FORMATO_PESOS = '"$"#,##0';
const COLOR_ENCABEZADO = "FF1E3A8A"; // azul oscuro
const COLOR_TOTAL = "FFE0E7FF"; // azul claro
const COLOR_ALERTA = "FFFEE2E2"; // rojo claro
const COLOR_AVISO = "FFFEF3C7"; // amarillo claro
const COLOR_EXITO = "FFD1FAE5"; // verde claro
const UN_DIA = 24 * 60 * 60 * 1000;

/* ============================== Utilidades ============================== */

/** Aplica estilo a la fila de títulos de una hoja. */
export function estilizarEncabezado(hoja: ExcelJS.Worksheet) {
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ENCABEZADO } };
  fila.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  fila.height = 32;
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columnCount } };
}

/** Agrega una fila de totales (en negrita y resaltada) separada por una fila vacía. */
function agregarTotal(hoja: ExcelJS.Worksheet, valores: Record<string, unknown>) {
  hoja.addRow([]);
  const fila = hoja.addRow(valores);
  fila.font = { bold: true };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL } };
}

function colorear(fila: ExcelJS.Row, argb: string) {
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export function nota(hoja: ExcelJS.Worksheet, texto: string) {
  hoja.addRow([]);
  hoja.addRow([texto]).font = { italic: true, color: { argb: "FF4B5563" } };
}

function sumarCampo<T>(lista: T[], campo: (x: T) => number) {
  return lista.reduce((acc, x) => acc + campo(x), 0);
}

export function nombreSeguro(texto: string) {
  return texto.replace(/[^\p{L}\p{N}]+/gu, "_");
}

export async function aArchivo(libro: ExcelJS.Workbook, nombreArchivo: string) {
  const buffer = await libro.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer as ArrayBuffer), nombreArchivo };
}

export function nuevoLibro() {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Gestión de Perfumerías";
  libro.created = new Date();
  return libro;
}

const sufijoPeriodo = (anio: number, mes?: number) => (mes ? `${anio}-${String(mes).padStart(2, "0")}` : `${anio}`);
const textoPeriodo = (anio: number, mes?: number) => (mes ? `${MESES[mes - 1]} ${anio}` : `Año ${anio}`);

/* ============================ Consultas ============================ */

/**
 * Cartera: créditos con saldo pendiente HOY, con cuotas vencidas y días de atraso.
 * Sin localId = todos los locales (para el consolidado).
 */
async function obtenerCartera(localId?: string) {
  const ahora = new Date();
  const filtroLocal = localId ? eq(facturas.localId, localId) : undefined;

  const [creditos, cuotasPendientes] = await Promise.all([
    db
      .select({
        id: facturas.id,
        local: locales.nombre,
        numero: facturas.numero,
        creadoEn: facturas.creadoEn,
        identificacion: facturas.clienteIdentificacion,
        cliente: facturas.clienteNombre,
        telefono: facturas.clienteTelefono,
        direccion: facturas.clienteDireccion,
        sector: facturas.clienteSector,
        vendedor: facturas.vendedorNombre,
        total: facturas.total,
        saldo: facturas.saldo,
      })
      .from(facturas)
      .innerJoin(locales, eq(facturas.localId, locales.id))
      .where(and(filtroLocal, eq(facturas.anulada, false), eq(facturas.tipo, "CREDITO"), eq(facturas.estado, "PENDIENTE"))),
    db
      .select({
        facturaId: cuotas.facturaId,
        fechaVencimiento: cuotas.fechaVencimiento,
        pendiente: sql<number>`(${cuotas.valor} - ${cuotas.valorPagado})::int`,
      })
      .from(cuotas)
      .innerJoin(facturas, eq(cuotas.facturaId, facturas.id))
      .where(and(filtroLocal, eq(facturas.anulada, false), eq(cuotas.anulada, false), eq(facturas.estado, "PENDIENTE"), eq(cuotas.estado, "PENDIENTE")))
      .orderBy(asc(cuotas.fechaVencimiento)),
  ]);

  const cuotasPorFactura = new Map<string, typeof cuotasPendientes>();
  for (const c of cuotasPendientes) {
    const lista = cuotasPorFactura.get(c.facturaId) ?? [];
    lista.push(c);
    cuotasPorFactura.set(c.facturaId, lista);
  }

  return creditos
    .map((f) => {
      const pendientes = cuotasPorFactura.get(f.id) ?? []; // ya vienen ordenadas por fecha
      const vencidas = pendientes.filter((c) => c.fechaVencimiento < ahora);
      const proxima = pendientes.find((c) => c.fechaVencimiento >= ahora);
      return {
        ...f,
        abonado: f.total - f.saldo,
        cuotasVencidas: vencidas.length,
        valorVencido: sumarCampo(vencidas, (c) => c.pendiente),
        diasAtraso: vencidas[0] ? Math.floor((ahora.getTime() - vencidas[0].fechaVencimiento.getTime()) / UN_DIA) : 0,
        proximaCuota: proxima?.fechaVencimiento ?? null,
        valorProximaCuota: proxima?.pendiente ?? 0,
      };
    })
    .sort((a, b) => b.diasAtraso - a.diasAtraso || b.saldo - a.saldo);
}

type FilaCartera = Awaited<ReturnType<typeof obtenerCartera>>[number];

/* ============================ Hojas ============================ */

function hojaCartera(libro: ExcelJS.Workbook, cartera: FilaCartera[], conLocal: boolean) {
  const hoja = libro.addWorksheet("Cartera");
  hoja.columns = [
    ...(conLocal ? [{ header: "Local", key: "local", width: 20 }] : []),
    { header: "N° factura", key: "numero", width: 12 },
    { header: "Fecha venta", key: "fechaVenta", width: 13 },
    { header: "Identificación", key: "identificacion", width: 16 },
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Teléfono", key: "telefono", width: 15 },
    { header: "Dirección", key: "direccion", width: 26 },
    { header: "Sector", key: "sector", width: 18 },
    { header: "Vendedor", key: "vendedor", width: 22 },
    { header: "Total crédito", key: "total", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Abonado", key: "abonado", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Saldo pendiente", key: "saldo", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Cuotas vencidas", key: "cuotasVencidas", width: 11 },
    { header: "Valor vencido", key: "valorVencido", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Días de atraso", key: "diasAtraso", width: 11 },
    { header: "Próxima cuota", key: "proximaCuota", width: 13 },
    { header: "Valor próxima cuota", key: "valorProximaCuota", width: 15, style: { numFmt: FORMATO_PESOS } },
  ];
  for (const c of cartera) {
    const fila = hoja.addRow({
      ...c,
      numero: numeroFactura(c.numero),
      fechaVenta: fecha(c.creadoEn),
      proximaCuota: c.proximaCuota ? fecha(c.proximaCuota) : "—",
    });
    // Rojo: más de 30 días de atraso · Amarillo: tiene algo vencido
    if (c.diasAtraso > 30) colorear(fila, COLOR_ALERTA);
    else if (c.cuotasVencidas > 0) colorear(fila, COLOR_AVISO);
  }
  estilizarEncabezado(hoja);
  agregarTotal(hoja, {
    [conLocal ? "local" : "numero"]: `TOTAL (${cartera.length} créditos)`,
    total: sumarCampo(cartera, (c) => c.total),
    abonado: sumarCampo(cartera, (c) => c.abonado),
    saldo: sumarCampo(cartera, (c) => c.saldo),
    cuotasVencidas: sumarCampo(cartera, (c) => c.cuotasVencidas),
    valorVencido: sumarCampo(cartera, (c) => c.valorVencido),
  });
  nota(
    hoja,
    `Estado de la cartera al ${fechaHora(new Date())} · Rojo = más de 30 días de atraso · Amarillo = tiene cuotas vencidas`,
  );
}

/* ======================= Reporte por local ======================= */

export async function generarReporteExcel(localId: string, anio: number, mes?: number) {
  const local = await obtenerLocal(localId);
  const { inicio, fin } = rangoPeriodo(anio, mes);
  const periodo = textoPeriodo(anio, mes);
  const delPeriodo = and(eq(facturas.localId, localId), gte(facturas.creadoEn, inicio), lt(facturas.creadoEn, fin));
  // Las ventas anuladas no cuentan en ninguna hoja del periodo (van aparte en "Ventas anuladas")
  const enPeriodo = and(delPeriodo, eq(facturas.anulada, false));

  const [
    estadisticas,
    listaFacturas,
    productosVendidos,
    listaAbonos,
    listaGastos,
    porVendedor,
    cartera,
    inventario,
    categorias,
    ventasAnuladas,
    gastosEliminados,
    deudasReporte,
    pagosDeudas,
    caja,
  ] = await Promise.all([
    obtenerEstadisticas(localId, anio),
    db.select().from(facturas).where(enPeriodo).orderBy(asc(facturas.creadoEn)),
    db
      .select({
        // Nombre completo guardado en la venta (las facturas antiguas conservan su nombre original)
        nombre: facturaItems.nombreProducto,
        marca: sql<string>`coalesce(max(${facturaItems.marcaNombre}), '')`,
        contenidoMl: sql<number | null>`max(${facturaItems.contenidoMl})`,
        cantidad: sql<number>`sum(${facturaItems.cantidad})::int`,
        total: sql<number>`sum(${facturaItems.subtotal})::int`,
      })
      .from(facturaItems)
      .innerJoin(facturas, eq(facturaItems.facturaId, facturas.id))
      .where(enPeriodo)
      .groupBy(facturaItems.nombreProducto)
      .orderBy(desc(sql`sum(${facturaItems.cantidad})`)),
    db
      .select({
        creadoEn: abonos.creadoEn,
        valor: abonos.valor,
        medioPago: abonos.medioPago,
        valorEfectivo: abonos.valorEfectivo,
        valorTransferencia: abonos.valorTransferencia,
        nota: abonos.nota,
        numero: facturas.numero,
        cliente: facturas.clienteNombre,
        identificacion: facturas.clienteIdentificacion,
      })
      .from(abonos)
      .innerJoin(facturas, eq(abonos.facturaId, facturas.id))
      .where(
        and(
          eq(facturas.localId, localId),
          eq(facturas.anulada, false),
          eq(abonos.anulado, false),
          gte(abonos.creadoEn, inicio),
          lt(abonos.creadoEn, fin),
        ),
      )
      .orderBy(asc(abonos.creadoEn)),
    gastosDelPeriodo(localId, anio, mes),
    db
      .select({
        vendedor: facturas.vendedorNombre,
        cantidadContado: sql<number>`count(*) filter (where ${facturas.tipo} = 'NORMAL')::int`,
        ventasContado: sql<number>`coalesce(sum(${facturas.total}) filter (where ${facturas.tipo} = 'NORMAL'), 0)::int`,
        cantidadCredito: sql<number>`count(*) filter (where ${facturas.tipo} = 'CREDITO')::int`,
        ventasCredito: sql<number>`coalesce(sum(${facturas.total}) filter (where ${facturas.tipo} = 'CREDITO'), 0)::int`,
        totalVentas: sql<number>`sum(${facturas.total})::int`,
      })
      .from(facturas)
      .where(enPeriodo)
      .groupBy(facturas.vendedorNombre)
      .orderBy(desc(sql`sum(${facturas.total})`)),
    obtenerCartera(localId),
    db
      .select({
        codigo: productos.codigo,
        nombreCompleto: productos.nombreCompleto,
        marca: marcas.nombre,
        fragancia: productos.nombre,
        variante: productos.variante,
        concentracion: productos.concentracion,
        contenidoMl: productos.contenidoMl,
        genero: productos.genero,
        categoria: productos.categoria,
        precio: productos.precio,
        stock: productos.stock,
        stockMinimo: productos.stockMinimo,
      })
      .from(productos)
      .leftJoin(marcas, eq(marcas.id, productos.marcaId))
      .where(and(eq(productos.localId, localId), eq(productos.activo, true)))
      .orderBy(asc(productos.nombreCompleto)),
    ventasPorCategoria({ localId, anio, mes }),
    db.select().from(facturas).where(and(delPeriodo, eq(facturas.anulada, true))).orderBy(asc(facturas.creadoEn)),
    gastosDelPeriodo(localId, anio, mes, true),
    deudasParaReporte(localId, rangoDias(anio, mes).desde, rangoDias(anio, mes).hasta),
    pagosDeudasParaReporte(localId, inicio, fin),
    movimientosCaja(localId, rangoDias(anio, mes).desde, rangoDias(anio, mes).hasta),
  ]);

  const libro = nuevoLibro();

  /* ---------- Hoja 1: Resumen ---------- */
  const resumen = libro.addWorksheet("Resumen");
  resumen.columns = [
    { header: "Mes", key: "nombre", width: 16 },
    { header: "Facturas de contado", key: "cantidadContado", width: 14 },
    { header: "Ventas de contado", key: "ventasContado", width: 20, style: { numFmt: FORMATO_PESOS } },
    { header: "Créditos otorgados", key: "cantidadCredito", width: 14 },
    { header: "Valor en créditos", key: "ventasCredito", width: 20, style: { numFmt: FORMATO_PESOS } },
    { header: "Abonos recibidos", key: "recaudoAbonos", width: 20, style: { numFmt: FORMATO_PESOS } },
    { header: "Total vendido", key: "totalVentas", width: 20, style: { numFmt: FORMATO_PESOS } },
    { header: "Total recaudado", key: "totalRecaudado", width: 20, style: { numFmt: FORMATO_PESOS } },
    { header: "Recibido en efectivo", key: "recibidoEfectivo", width: 20, style: { numFmt: FORMATO_PESOS } },
    { header: "Recibido en transferencia", key: "recibidoTransferencia", width: 20, style: { numFmt: FORMATO_PESOS } },
    { header: "Gastos del negocio (contado + pagos de deudas)", key: "gastos", width: 22, style: { numFmt: FORMATO_PESOS } },
    { header: "De eso, pagos de deudas", key: "pagosDeudas", width: 20, style: { numFmt: FORMATO_PESOS } },
    { header: "Utilidad (recibido − gastos del negocio)", key: "utilidad", width: 22, style: { numFmt: FORMATO_PESOS } },
    { header: "Gastos personales (no se restan)", key: "gastosPersonales", width: 22, style: { numFmt: FORMATO_PESOS } },
    { header: "Deudas adquiridas (informativo, no se restan)", key: "deudasAdquiridas", width: 24, style: { numFmt: FORMATO_PESOS } },
  ];
  const mesesIncluidos = mes ? estadisticas.meses.filter((m) => m.mes === mes) : estadisticas.meses;
  resumen.addRows(mesesIncluidos);
  if (!mes) {
    const filaTotal = resumen.addRow({ nombre: "TOTAL AÑO", ...estadisticas.totales });
    filaTotal.font = { bold: true };
    colorear(filaTotal, COLOR_TOTAL);
  }
  estilizarEncabezado(resumen);
  resumen.addRow([]);
  resumen.addRow([`Local: ${local.nombre}`]).font = { bold: true };
  resumen.addRow([`Periodo: ${periodo}`]);
  resumen.addRow([`Créditos pendientes hoy: ${estadisticas.creditosPendientes.cantidad}`]);
  resumen.addRow([`Saldo por cobrar hoy: $ ${estadisticas.creditosPendientes.saldo.toLocaleString("es-CO")}`]);
  resumen.addRow([
    `Deudas por pagar hoy: ${estadisticas.deudasPorPagar.cantidad} · saldo $ ${estadisticas.deudasPorPagar.saldo.toLocaleString("es-CO")}`,
  ]);
  resumen.addRow(["Los gastos a crédito no se suman como gasto: se suma cada pago de la deuda, el día en que se hace (ver «Deudas»)."]);
  resumen.addRow([`Generado: ${fechaHora(new Date())}`]);

  /* ---------- Hoja 2: Facturas ---------- */
  const hojaFacturas = libro.addWorksheet("Facturas");
  hojaFacturas.columns = [
    { header: "N° factura", key: "numero", width: 12 },
    { header: "Fecha", key: "fecha", width: 22 },
    { header: "Tipo", key: "tipo", width: 12 },
    { header: "Estado", key: "estado", width: 13 },
    { header: "Identificación", key: "identificacion", width: 16 },
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Teléfono", key: "telefono", width: 15 },
    { header: "Sector", key: "sector", width: 18 },
    { header: "Vendedor", key: "vendedor", width: 22 },
    { header: "Subtotal", key: "subtotal", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Adicional", key: "adicional", width: 13, style: { numFmt: FORMATO_PESOS } },
    { header: "Descuento", key: "descuento", width: 13, style: { numFmt: FORMATO_PESOS } },
    { header: "Total", key: "total", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Saldo pendiente", key: "saldo", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Medio de pago", key: "medioPago", width: 16 },
    { header: "Efectivo", key: "valorEfectivo", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Transferencia", key: "valorTransferencia", width: 15, style: { numFmt: FORMATO_PESOS } },
  ];
  hojaFacturas.addRows(
    listaFacturas.map((f) => ({
      numero: numeroFactura(f.numero),
      fecha: fechaHora(f.creadoEn),
      tipo: f.tipo === "NORMAL" ? "Contado" : "Crédito",
      estado: f.estado === "COMPLETADA" ? "Completada" : "Pendiente",
      identificacion: f.clienteIdentificacion,
      cliente: f.clienteNombre,
      telefono: f.clienteTelefono,
      sector: f.clienteSector,
      vendedor: f.vendedorNombre,
      subtotal: f.subtotal,
      adicional: f.adicional,
      descuento: f.descuento,
      total: f.total,
      saldo: f.saldo,
      // En el crédito el medio de pago se registra en cada abono (ver la hoja "Abonos")
      medioPago: f.medioPago ? textoMedioPago(f.medioPago) : "A crédito",
      valorEfectivo: f.valorEfectivo,
      valorTransferencia: f.valorTransferencia,
    })),
  );
  estilizarEncabezado(hojaFacturas);
  if (listaFacturas.length) {
    agregarTotal(hojaFacturas, {
      numero: `TOTAL (${listaFacturas.length})`,
      subtotal: sumarCampo(listaFacturas, (f) => f.subtotal),
      adicional: sumarCampo(listaFacturas, (f) => f.adicional),
      descuento: sumarCampo(listaFacturas, (f) => f.descuento),
      total: sumarCampo(listaFacturas, (f) => f.total),
      saldo: sumarCampo(listaFacturas, (f) => f.saldo),
    });
  }

  /* ---------- Hoja 3: Productos vendidos ---------- */
  const hojaProductos = libro.addWorksheet("Productos vendidos");
  hojaProductos.columns = [
    { header: "Producto", key: "nombre", width: 50 },
    { header: "Marca", key: "marca", width: 20 },
    { header: "Contenido (ml)", key: "contenidoMl", width: 14 },
    { header: "Unidades vendidas", key: "cantidad", width: 18 },
    { header: "Valor vendido", key: "total", width: 20, style: { numFmt: FORMATO_PESOS } },
  ];
  hojaProductos.addRows(productosVendidos);
  estilizarEncabezado(hojaProductos);

  /* ---------- Ventas por categoría (mismos cortes del dashboard) ---------- */
  hojaVentasPorCategoria(libro, categorias, periodo);

  /* ---------- Hoja 4: Abonos ---------- */
  const hojaAbonos = libro.addWorksheet("Abonos");
  hojaAbonos.columns = [
    { header: "Fecha", key: "fecha", width: 22 },
    { header: "N° factura", key: "numero", width: 12 },
    { header: "Identificación", key: "identificacion", width: 16 },
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Valor", key: "valor", width: 16, style: { numFmt: FORMATO_PESOS } },
    { header: "Medio de pago", key: "medioPago", width: 16 },
    { header: "Efectivo", key: "valorEfectivo", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Transferencia", key: "valorTransferencia", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Nota", key: "nota", width: 30 },
  ];
  hojaAbonos.addRows(
    listaAbonos.map((a) => ({
      ...a,
      fecha: fechaHora(a.creadoEn),
      numero: numeroFactura(a.numero),
      medioPago: textoMedioPago(a.medioPago),
      nota: a.nota ?? "",
    })),
  );
  estilizarEncabezado(hojaAbonos);
  if (listaAbonos.length) {
    agregarTotal(hojaAbonos, { fecha: `TOTAL (${listaAbonos.length})`, valor: sumarCampo(listaAbonos, (a) => a.valor) });
  }

  /* ---------- Hoja 5: Ventas por vendedor ---------- */
  const hojaVendedores = libro.addWorksheet("Ventas por vendedor");
  hojaVendedores.columns = [
    { header: "Vendedor", key: "vendedor", width: 28 },
    { header: "Facturas de contado", key: "cantidadContado", width: 14 },
    { header: "Ventas de contado", key: "ventasContado", width: 18, style: { numFmt: FORMATO_PESOS } },
    { header: "Créditos otorgados", key: "cantidadCredito", width: 14 },
    { header: "Valor en créditos", key: "ventasCredito", width: 18, style: { numFmt: FORMATO_PESOS } },
    { header: "Total vendido", key: "totalVentas", width: 18, style: { numFmt: FORMATO_PESOS } },
    { header: "% del total", key: "porcentaje", width: 12, style: { numFmt: "0.0%" } },
  ];
  const totalLocal = sumarCampo(porVendedor, (v) => v.totalVentas);
  hojaVendedores.addRows(porVendedor.map((v) => ({ ...v, porcentaje: totalLocal ? v.totalVentas / totalLocal : 0 })));
  estilizarEncabezado(hojaVendedores);
  if (porVendedor.length) {
    agregarTotal(hojaVendedores, {
      vendedor: "TOTAL",
      cantidadContado: sumarCampo(porVendedor, (v) => v.cantidadContado),
      ventasContado: sumarCampo(porVendedor, (v) => v.ventasContado),
      cantidadCredito: sumarCampo(porVendedor, (v) => v.cantidadCredito),
      ventasCredito: sumarCampo(porVendedor, (v) => v.ventasCredito),
      totalVentas: totalLocal,
      porcentaje: totalLocal ? 1 : 0,
    });
  }

  /* ---------- Hojas 6 y 7: Gastos del negocio y Gastos personales (estos no se restan de la utilidad) ---------- */
  const hojaDeGastos = (nombre: string, lista: typeof listaGastos, textoNota: string) => {
    const hoja = libro.addWorksheet(nombre);
    hoja.columns = [
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Categoría", key: "categoria", width: 26 },
      { header: "Descripción", key: "descripcion", width: 36 },
      { header: "Medio de pago", key: "medioPago", width: 16 },
      { header: "Valor", key: "valor", width: 16, style: { numFmt: FORMATO_PESOS } },
      { header: "Registrado por", key: "usuario", width: 24 },
      { header: "Nota", key: "nota", width: 34 },
    ];
    for (const g of lista) {
      const fila = hoja.addRow({
        fecha: fechaDia(g.fecha),
        categoria: g.categoriaNombre,
        descripcion: g.descripcion ?? "",
        medioPago: textoMedioPagoGasto(g.medioPago),
        valor: g.valor,
        usuario: g.usuarioNombre,
        // Un gasto a crédito no es dinero que salió ese día: no suma en el total de esta hoja
        nota: g.medioPago === "CREDITO" ? "Se paga en cuotas, ver Deudas (no suma en el total)" : "",
      });
      if (g.medioPago === "CREDITO") fila.font = { italic: true, color: { argb: "FF4B5563" } };
    }
    estilizarEncabezado(hoja);
    const deContado = lista.filter((g) => g.medioPago !== "CREDITO");
    if (lista.length) agregarTotal(hoja, { fecha: `TOTAL DE CONTADO (${deContado.length})`, valor: sumarCampo(deContado, (g) => g.valor) });
    nota(hoja, textoNota);
  };
  const pagosNegocio = sumarCampo(pagosDeudas.filter((p) => !p.anulado && !p.personal), (p) => p.valor);
  hojaDeGastos(
    "Gastos",
    listaGastos.filter((g) => !g.personal),
    `Periodo: ${periodo} · Gastos del negocio: se restan de la utilidad. Los gastos a crédito no suman aquí; se suman sus pagos ($ ${pagosNegocio.toLocaleString("es-CO")} en el periodo, hoja «Pagos de deudas»).`,
  );
  hojaDeGastos(
    "Gastos personales",
    listaGastos.filter((g) => g.personal),
    `Periodo: ${periodo} · Gastos propios de la dueña: se muestran aparte y NO se restan de la utilidad`,
  );

  /* ---------- Deudas, Pagos de deudas y Caja diaria ---------- */
  hojaDeudas(libro, deudasReporte, periodo);
  hojaPagosDeudas(libro, pagosDeudas, periodo);
  hojaCajaDiaria(libro, caja, periodo);

  /* ---------- Hoja 8: Cartera (hoy) ---------- */
  hojaCartera(libro, cartera, false);

  /* ---------- Hoja 9: Inventario (hoy) ---------- */
  const hojaInventario = libro.addWorksheet("Inventario");
  hojaInventario.columns = [
    { header: "Código", key: "codigo", width: 14 },
    { header: "Producto (nombre completo)", key: "nombre", width: 50 },
    { header: "Marca", key: "marca", width: 20 },
    { header: "Fragancia", key: "fragancia", width: 24 },
    { header: "Variante", key: "variante", width: 16 },
    { header: "Concentración", key: "concentracion", width: 22 },
    { header: "Contenido (ml)", key: "contenidoMl", width: 14 },
    { header: "Género", key: "genero", width: 11 },
    { header: "Categoría", key: "categoria", width: 16 },
    { header: "Precio", key: "precio", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Stock", key: "stock", width: 10 },
    { header: "Stock mínimo", key: "stockMinimo", width: 11 },
    { header: "Valor en inventario", key: "valor", width: 18, style: { numFmt: FORMATO_PESOS } },
    { header: "Estado", key: "estado", width: 14 },
  ];
  for (const p of inventario) {
    const estado = p.stock <= 0 ? "Agotado" : p.stock <= p.stockMinimo ? "Stock bajo" : "Disponible";
    const fila = hojaInventario.addRow({
      ...p,
      codigo: p.codigo ?? "",
      nombre: p.nombreCompleto,
      marca: p.marca ?? "",
      variante: p.variante ?? "",
      concentracion: p.concentracion ? ETIQUETA_CONCENTRACION[p.concentracion] : "",
      contenidoMl: p.contenidoMl ?? "",
      genero: p.genero ? ETIQUETA_GENERO[p.genero] : "",
      categoria: p.categoria ? ETIQUETA_CATEGORIA[p.categoria] : "",
      valor: p.precio * Math.max(p.stock, 0),
      estado,
    });
    if (estado === "Agotado") colorear(fila, COLOR_ALERTA);
    else if (estado === "Stock bajo") colorear(fila, COLOR_AVISO);
  }
  estilizarEncabezado(hojaInventario);
  agregarTotal(hojaInventario, {
    nombre: `TOTAL (${inventario.length} productos)`,
    stock: sumarCampo(inventario, (p) => Math.max(p.stock, 0)),
    valor: sumarCampo(inventario, (p) => p.precio * Math.max(p.stock, 0)),
  });
  nota(hojaInventario, `Inventario al ${fechaHora(new Date())} (valorizado a precio de venta) · Rojo = agotado · Amarillo = stock bajo`);

  /* ---------- Hoja 9: Ventas anuladas (no suman en ninguna otra hoja) ---------- */
  const hojaAnuladas = libro.addWorksheet("Ventas anuladas");
  hojaAnuladas.columns = [
    { header: "N° factura", key: "numero", width: 12 },
    { header: "Fecha de la venta", key: "fecha", width: 22 },
    { header: "Tipo", key: "tipo", width: 12 },
    { header: "Identificación", key: "identificacion", width: 16 },
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Total", key: "total", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Motivo", key: "motivo", width: 40 },
    { header: "Anulada por", key: "anuladaPor", width: 24 },
    { header: "Fecha de anulación", key: "anuladaEn", width: 22 },
  ];
  hojaAnuladas.addRows(
    ventasAnuladas.map((f) => ({
      numero: numeroFactura(f.numero),
      fecha: fechaHora(f.creadoEn),
      tipo: f.tipo === "NORMAL" ? "Contado" : "Crédito",
      identificacion: f.clienteIdentificacion,
      cliente: f.clienteNombre,
      total: f.total,
      motivo: f.motivoAnulacion ?? "",
      anuladaPor: f.anuladaPorNombre ?? "",
      anuladaEn: f.anuladaEn ? fechaHora(f.anuladaEn) : "",
    })),
  );
  estilizarEncabezado(hojaAnuladas);

  /* ---------- Hoja 10: Gastos eliminados (no suman en los gastos ni en la utilidad) ---------- */
  const hojaGastosEliminados = libro.addWorksheet("Gastos eliminados");
  hojaGastosEliminados.columns = [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Categoría", key: "categoria", width: 26 },
    { header: "Valor", key: "valor", width: 16, style: { numFmt: FORMATO_PESOS } },
    { header: "Medio de pago", key: "medioPago", width: 16 },
    { header: "Motivo", key: "motivo", width: 40 },
    { header: "Eliminado por", key: "eliminadoPor", width: 24 },
    { header: "Fecha de eliminación", key: "eliminadoEn", width: 22 },
  ];
  hojaGastosEliminados.addRows(
    gastosEliminados.map((g) => ({
      fecha: fechaDia(g.fecha),
      categoria: g.categoriaNombre,
      valor: g.valor,
      medioPago: textoMedioPagoGasto(g.medioPago),
      motivo: g.motivoAnulacion ?? "",
      eliminadoPor: g.anuladoPorNombre ?? "",
      eliminadoEn: g.anuladoEn ? fechaHora(g.anuladoEn) : "",
    })),
  );
  estilizarEncabezado(hojaGastosEliminados);

  return aArchivo(libro, `Reporte_${nombreSeguro(local.nombre)}_${sufijoPeriodo(anio, mes)}.xlsx`);
}

/* ====================== Ventas por categoría (dashboard) ====================== */

/** Los mismos cortes del dashboard: público, tipo, marca (todas) y tamaño. */
/* ======================= Hojas de deudas y caja ======================= */

/** «Deudas»: las adquiridas en el periodo y las pendientes hoy. Amarillo = pendiente, verde = pagada, rojo = vencida o anulada. */
function hojaDeudas(libro: ExcelJS.Workbook, lista: Awaited<ReturnType<typeof deudasParaReporte>>, periodo: string) {
  const hoja = libro.addWorksheet("Deudas");
  hoja.columns = [
    { header: "Acreedor", key: "acreedor", width: 28 },
    { header: "Fecha", key: "fecha", width: 13 },
    { header: "Categoría", key: "categoria", width: 22 },
    { header: "Descripción", key: "descripcion", width: 30 },
    { header: "Total", key: "total", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Pagado", key: "pagado", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Saldo", key: "saldo", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Cuotas pagadas", key: "cuotas", width: 12 },
    { header: "Forma de pago final", key: "formaPago", width: 24 },
    { header: "Próxima fecha", key: "proxima", width: 20 },
  ];
  for (const d of lista) {
    const vencida = d.estado === "PENDIENTE" && !!d.proximaCuota && estaVencida(new Date(d.proximaCuota.fechaVencimiento));
    const fila = hoja.addRow({
      acreedor: d.acreedor,
      fecha: fechaDia(d.fecha),
      categoria: d.categoriaNombre + (d.personal ? " (personal)" : ""),
      descripcion: d.descripcion ?? "",
      total: d.valorTotal,
      pagado: d.estado === "ANULADA" ? 0 : d.pagado,
      saldo: d.estado === "PENDIENTE" ? d.saldo : 0,
      // El estado siempre va escrito (no solo el color)
      estado: vencida ? "Vencida" : TEXTO_ESTADO_DEUDA[d.estado],
      cuotas: `${d.cuotasPagadas} de ${d.totalCuotas}`,
      formaPago: d.estado === "PAGADA" && d.resumenMedioPago ? textoFormaPagoFinal(d.resumenMedioPago) : "—",
      proxima: d.proximaCuota ? fechaHora(d.proximaCuota.fechaVencimiento) : "—",
    });
    colorear(fila, d.estado === "PAGADA" ? COLOR_EXITO : d.estado === "ANULADA" || vencida ? COLOR_ALERTA : COLOR_AVISO);
  }
  estilizarEncabezado(hoja);
  const vigentes = lista.filter((d) => d.estado !== "ANULADA");
  if (lista.length) {
    agregarTotal(hoja, {
      acreedor: `TOTAL (${vigentes.length} deudas, sin anuladas)`,
      total: sumarCampo(vigentes, (d) => d.valorTotal),
      pagado: sumarCampo(vigentes, (d) => d.pagado),
      saldo: sumarCampo(vigentes.filter((d) => d.estado === "PENDIENTE"), (d) => d.saldo),
    });
  }
  nota(
    hoja,
    `Deudas adquiridas en ${periodo} y todas las pendientes al ${fechaHora(new Date())} · Amarillo = pendiente · Verde = pagada · Rojo = vencida o anulada · El total de una deuda NO se suma como gasto: se suman sus pagos.`,
  );
}

/** «Pagos de deudas»: cada pago del periodo (los anulados, en rojo, no suman). */
function hojaPagosDeudas(libro: ExcelJS.Workbook, lista: Awaited<ReturnType<typeof pagosDeudasParaReporte>>, periodo: string) {
  const hoja = libro.addWorksheet("Pagos de deudas");
  hoja.columns = [
    { header: "Fecha", key: "fecha", width: 22 },
    { header: "Acreedor", key: "acreedor", width: 28 },
    { header: "Valor", key: "valor", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Medio", key: "medio", width: 15 },
    { header: "Efectivo", key: "efectivo", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Transferencia", key: "transferencia", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Registrado por", key: "usuario", width: 24 },
    { header: "Estado", key: "estado", width: 30 },
  ];
  for (const p of lista) {
    const fila = hoja.addRow({
      fecha: fechaHora(p.fecha),
      acreedor: p.acreedor + (p.personal ? " (personal)" : ""),
      valor: p.valor,
      medio: textoMedioPago(p.medioPago),
      efectivo: p.valorEfectivo,
      transferencia: p.valorTransferencia,
      usuario: p.usuarioNombre,
      estado: p.anulado ? `Anulado: ${p.motivoAnulacion ?? ""}` : "Vigente",
    });
    if (p.anulado) colorear(fila, COLOR_ALERTA);
  }
  estilizarEncabezado(hoja);
  const vigentes = lista.filter((p) => !p.anulado);
  if (lista.length) {
    agregarTotal(hoja, {
      fecha: `TOTAL (${vigentes.length} pagos vigentes)`,
      valor: sumarCampo(vigentes, (p) => p.valor),
      efectivo: sumarCampo(vigentes, (p) => p.valorEfectivo),
      transferencia: sumarCampo(vigentes, (p) => p.valorTransferencia),
    });
  }
  nota(hoja, `Periodo: ${periodo} · Cada pago salió de la caja el día del pago y se suma a los gastos (los personales, a gastos personales) · Rojo = anulado, no suma`);
}

/** «Caja diaria»: un día por fila con entradas, salidas y saldo, en efectivo y transferencia. */
function hojaCajaDiaria(libro: ExcelJS.Workbook, caja: Awaited<ReturnType<typeof movimientosCaja>>, periodo: string) {
  const hoja = libro.addWorksheet("Caja diaria");
  const dinero = (header: string, key: string) => ({ header, key, width: 16, style: { numFmt: FORMATO_PESOS } });
  hoja.columns = [
    { header: "Día", key: "dia", width: 13 },
    dinero("Entradas efectivo", "entradasEfectivo"),
    dinero("Entradas transferencia", "entradasTransferencia"),
    dinero("Salidas efectivo", "salidasEfectivo"),
    dinero("Salidas transferencia", "salidasTransferencia"),
    dinero("Saldo efectivo", "saldoEfectivo"),
    dinero("Saldo transferencia", "saldoTransferencia"),
    dinero("Saldo total", "saldoTotal"),
  ];
  const filas = cajaPorDia(caja.movimientos);
  for (const f of filas) {
    const fila = hoja.addRow({ ...f, dia: fechaDia(f.dia) });
    if (f.saldoTotal < 0) colorear(fila, COLOR_ALERTA);
  }
  estilizarEncabezado(hoja);
  if (filas.length) {
    const suma = (k: Exclude<keyof (typeof filas)[number], "dia">) => sumarCampo(filas, (f) => f[k]);
    agregarTotal(hoja, {
      dia: `TOTAL (${filas.length} días)`,
      entradasEfectivo: suma("entradasEfectivo"),
      entradasTransferencia: suma("entradasTransferencia"),
      salidasEfectivo: suma("salidasEfectivo"),
      salidasTransferencia: suma("salidasTransferencia"),
      saldoEfectivo: suma("saldoEfectivo"),
      saldoTransferencia: suma("saldoTransferencia"),
      saldoTotal: suma("saldoTotal"),
    });
  }
  const proveedores = sumarCampo(caja.pagosProveedores, (p) => p.efectivo + p.transferencia);
  nota(
    hoja,
    `Periodo: ${periodo} · Entradas = ventas de contado + abonos · Salidas = gastos de contado + pagos de deudas (los gastos a crédito no salen de la caja) · Rojo = el día salió más de lo que entró${proveedores ? ` · Pagos a proveedores del periodo (informativo, no se restan): $ ${proveedores.toLocaleString("es-CO")}` : ""}`,
  );
}

function hojaVentasPorCategoria(libro: ExcelJS.Workbook, categorias: VentasPorCategoria, periodo: string) {
  const hoja = libro.addWorksheet("Ventas por categoría");
  hoja.columns = [
    { header: "Corte", key: "corte", width: 16 },
    { header: "Categoría", key: "categoria", width: 32 },
    { header: "Unidades vendidas", key: "unidades", width: 18 },
    { header: "Valor vendido", key: "valor", width: 20, style: { numFmt: FORMATO_PESOS } },
    { header: "% del valor", key: "porcentaje", width: 12, style: { numFmt: "0.0%" } },
  ];
  const cortes = [
    { corte: "Público", filas: categorias.porPublico },
    { corte: "Tipo", filas: categorias.porTipo },
    { corte: "Marca", filas: categorias.porMarca },
    { corte: "Contenido (ml)", filas: categorias.porTamano },
  ];
  // Todos los cortes reparten las mismas ventas: el total se toma de uno solo
  const totalUnidades = sumarCampo(categorias.porPublico, (c) => c.unidades);
  const totalValor = sumarCampo(categorias.porPublico, (c) => c.valor);
  for (const { corte, filas } of cortes) {
    for (const c of filas) {
      hoja.addRow({ corte, categoria: c.etiqueta, unidades: c.unidades, valor: c.valor, porcentaje: totalValor ? c.valor / totalValor : 0 });
    }
  }
  estilizarEncabezado(hoja);
  agregarTotal(hoja, { corte: "TOTAL", categoria: "Cada corte suma este total", unidades: totalUnidades, valor: totalValor, porcentaje: totalValor ? 1 : 0 });
  nota(
    hoja,
    `Periodo: ${periodo} · La categoría es la que tenía cada producto el día de la venta · «Sin categoría» = ventas anteriores a la clasificación · Valor = productos vendidos (sin descuentos ni costos adicionales)`,
  );
}

/* =================== Reporte consolidado (todos los locales) =================== */

export async function generarReporteConsolidado(anio: number, mes?: number) {
  const listaLocales = await listarLocales();
  const [estadisticas, cartera, categorias] = await Promise.all([
    Promise.all(listaLocales.map((l) => obtenerEstadisticas(l.id, anio))),
    obtenerCartera(),
    ventasPorCategoria({ anio, mes }),
  ]);

  const libro = nuevoLibro();

  /* ---------- Hoja 1: Comparativo por local ---------- */
  const hoja = libro.addWorksheet("Comparativo locales");
  hoja.columns = [
    { header: "Local", key: "local", width: 24 },
    { header: "Facturas de contado", key: "cantidadContado", width: 14 },
    { header: "Ventas de contado", key: "ventasContado", width: 18, style: { numFmt: FORMATO_PESOS } },
    { header: "Créditos otorgados", key: "cantidadCredito", width: 14 },
    { header: "Valor en créditos", key: "ventasCredito", width: 18, style: { numFmt: FORMATO_PESOS } },
    { header: "Abonos recibidos", key: "recaudoAbonos", width: 18, style: { numFmt: FORMATO_PESOS } },
    { header: "Total vendido", key: "totalVentas", width: 18, style: { numFmt: FORMATO_PESOS } },
    { header: "Total recaudado", key: "totalRecaudado", width: 18, style: { numFmt: FORMATO_PESOS } },
    { header: "% de las ventas", key: "porcentaje", width: 12, style: { numFmt: "0.0%" } },
    { header: "Créditos pendientes hoy", key: "creditosPendientes", width: 14 },
    { header: "Saldo por cobrar hoy", key: "saldoPorCobrar", width: 18, style: { numFmt: FORMATO_PESOS } },
    { header: "Deudas por pagar hoy", key: "deudasPorPagar", width: 18, style: { numFmt: FORMATO_PESOS } },
  ];
  const filas = estadisticas.map((e) => {
    const datos = mes ? e.meses[mes - 1] : e.totales;
    return {
      local: e.local.nombre,
      cantidadContado: datos.cantidadContado,
      ventasContado: datos.ventasContado,
      cantidadCredito: datos.cantidadCredito,
      ventasCredito: datos.ventasCredito,
      recaudoAbonos: datos.recaudoAbonos,
      totalVentas: datos.totalVentas,
      totalRecaudado: datos.totalRecaudado,
      creditosPendientes: e.creditosPendientes.cantidad,
      saldoPorCobrar: e.creditosPendientes.saldo,
      deudasPorPagar: e.deudasPorPagar.saldo,
    };
  });
  filas.sort((a, b) => b.totalVentas - a.totalVentas);
  const totalVentas = sumarCampo(filas, (f) => f.totalVentas);
  hoja.addRows(filas.map((f) => ({ ...f, porcentaje: totalVentas ? f.totalVentas / totalVentas : 0 })));
  estilizarEncabezado(hoja);
  agregarTotal(hoja, {
    local: `TOTAL (${filas.length} locales)`,
    cantidadContado: sumarCampo(filas, (f) => f.cantidadContado),
    ventasContado: sumarCampo(filas, (f) => f.ventasContado),
    cantidadCredito: sumarCampo(filas, (f) => f.cantidadCredito),
    ventasCredito: sumarCampo(filas, (f) => f.ventasCredito),
    recaudoAbonos: sumarCampo(filas, (f) => f.recaudoAbonos),
    totalVentas,
    totalRecaudado: sumarCampo(filas, (f) => f.totalRecaudado),
    porcentaje: totalVentas ? 1 : 0,
    creditosPendientes: sumarCampo(filas, (f) => f.creditosPendientes),
    saldoPorCobrar: sumarCampo(filas, (f) => f.saldoPorCobrar),
    deudasPorPagar: sumarCampo(filas, (f) => f.deudasPorPagar),
  });
  nota(hoja, `Periodo: ${textoPeriodo(anio, mes)} · Créditos, saldo por cobrar y deudas por pagar al día de hoy · Generado: ${fechaHora(new Date())}`);

  /* ---------- Hoja 2: Ventas por categoría de todos los locales ---------- */
  hojaVentasPorCategoria(libro, categorias, textoPeriodo(anio, mes));

  /* ---------- Hoja 3: Cartera de todos los locales ---------- */
  hojaCartera(libro, cartera, true);

  return aArchivo(libro, `Reporte_Consolidado_${sufijoPeriodo(anio, mes)}.xlsx`);
}

/* ============================ Respuesta HTTP ============================ */

/** Convierte un archivo generado en una respuesta HTTP de descarga. */
export function respuestaExcel({ buffer, nombreArchivo }: { buffer: Buffer; nombreArchivo: string }) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(nombreArchivo)}"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`,
      "Cache-Control": "no-store",
    },
  });
}
