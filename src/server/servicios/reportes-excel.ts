/**
 * Generación de reportes en Excel (.xlsx).
 *
 * Reporte POR LOCAL (anual o mensual):
 *  - Resumen, Facturas, Productos vendidos, Abonos, Ventas por vendedor y Gastos → datos del periodo elegido.
 *  - Cartera e Inventario → foto del momento en que se genera (lo que se debe y lo que hay hoy).
 *
 * Reporte CONSOLIDADO (solo administrador): todos los locales comparados + cartera de todos los locales.
 */
import "server-only";
import ExcelJS from "exceljs";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { abonos, cuotas, facturaItems, facturas, locales, productos } from "@/db/schema";
import { fecha, fechaDia, fechaHora, MESES, numeroFactura, rangoPeriodo } from "@/lib/formato";
import { textoMedioPago } from "@/lib/pagos";
import { obtenerEstadisticas } from "./estadisticas";
import { gastosDelPeriodo } from "./gastos";
import { listarLocales, obtenerLocal } from "./locales";

const FORMATO_PESOS = '"$"#,##0';
const COLOR_ENCABEZADO = "FF1E3A8A"; // azul oscuro
const COLOR_TOTAL = "FFE0E7FF"; // azul claro
const COLOR_ALERTA = "FFFEE2E2"; // rojo claro
const COLOR_AVISO = "FFFEF3C7"; // amarillo claro
const UN_DIA = 24 * 60 * 60 * 1000;

/* ============================== Utilidades ============================== */

/** Aplica estilo a la fila de títulos de una hoja. */
function estilizarEncabezado(hoja: ExcelJS.Worksheet) {
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

function nota(hoja: ExcelJS.Worksheet, texto: string) {
  hoja.addRow([]);
  hoja.addRow([texto]).font = { italic: true, color: { argb: "FF4B5563" } };
}

function sumarCampo<T>(lista: T[], campo: (x: T) => number) {
  return lista.reduce((acc, x) => acc + campo(x), 0);
}

function nombreSeguro(texto: string) {
  return texto.replace(/[^\p{L}\p{N}]+/gu, "_");
}

async function aArchivo(libro: ExcelJS.Workbook, nombreArchivo: string) {
  const buffer = await libro.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer as ArrayBuffer), nombreArchivo };
}

function nuevoLibro() {
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
      .where(and(filtroLocal, eq(facturas.tipo, "CREDITO"), eq(facturas.estado, "PENDIENTE"))),
    db
      .select({
        facturaId: cuotas.facturaId,
        fechaVencimiento: cuotas.fechaVencimiento,
        pendiente: sql<number>`(${cuotas.valor} - ${cuotas.valorPagado})::int`,
      })
      .from(cuotas)
      .innerJoin(facturas, eq(cuotas.facturaId, facturas.id))
      .where(and(filtroLocal, eq(facturas.estado, "PENDIENTE"), eq(cuotas.estado, "PENDIENTE")))
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
  const enPeriodo = and(eq(facturas.localId, localId), gte(facturas.creadoEn, inicio), lt(facturas.creadoEn, fin));

  const [estadisticas, listaFacturas, productosVendidos, listaAbonos, listaGastos, porVendedor, cartera, inventario] = await Promise.all([
    obtenerEstadisticas(localId, anio),
    db.select().from(facturas).where(enPeriodo).orderBy(asc(facturas.creadoEn)),
    db
      .select({
        nombre: facturaItems.nombreProducto,
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
      .where(and(eq(facturas.localId, localId), gte(abonos.creadoEn, inicio), lt(abonos.creadoEn, fin)))
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
      .select()
      .from(productos)
      .where(and(eq(productos.localId, localId), eq(productos.activo, true)))
      .orderBy(asc(productos.nombre)),
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
    { header: "Gastos", key: "gastos", width: 20, style: { numFmt: FORMATO_PESOS } },
    { header: "Utilidad (recibido − gastos)", key: "utilidad", width: 20, style: { numFmt: FORMATO_PESOS } },
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
    { header: "Producto", key: "nombre", width: 40 },
    { header: "Unidades vendidas", key: "cantidad", width: 18 },
    { header: "Valor vendido", key: "total", width: 20, style: { numFmt: FORMATO_PESOS } },
  ];
  hojaProductos.addRows(productosVendidos);
  estilizarEncabezado(hojaProductos);

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

  /* ---------- Hoja 6: Gastos ---------- */
  const hojaGastos = libro.addWorksheet("Gastos");
  hojaGastos.columns = [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Categoría", key: "categoria", width: 26 },
    { header: "Descripción", key: "descripcion", width: 36 },
    { header: "Medio de pago", key: "medioPago", width: 16 },
    { header: "Valor", key: "valor", width: 16, style: { numFmt: FORMATO_PESOS } },
    { header: "Registrado por", key: "usuario", width: 24 },
  ];
  hojaGastos.addRows(
    listaGastos.map((g) => ({
      fecha: fechaDia(g.fecha),
      categoria: g.categoriaNombre,
      descripcion: g.descripcion ?? "",
      medioPago: textoMedioPago(g.medioPago),
      valor: g.valor,
      usuario: g.usuarioNombre,
    })),
  );
  estilizarEncabezado(hojaGastos);
  if (listaGastos.length) {
    agregarTotal(hojaGastos, { fecha: `TOTAL (${listaGastos.length})`, valor: sumarCampo(listaGastos, (g) => g.valor) });
  }

  /* ---------- Hoja 7: Cartera (hoy) ---------- */
  hojaCartera(libro, cartera, false);

  /* ---------- Hoja 8: Inventario (hoy) ---------- */
  const hojaInventario = libro.addWorksheet("Inventario");
  hojaInventario.columns = [
    { header: "Código", key: "codigo", width: 14 },
    { header: "Producto", key: "nombre", width: 40 },
    { header: "Precio", key: "precio", width: 15, style: { numFmt: FORMATO_PESOS } },
    { header: "Stock", key: "stock", width: 10 },
    { header: "Stock mínimo", key: "stockMinimo", width: 11 },
    { header: "Valor en inventario", key: "valor", width: 18, style: { numFmt: FORMATO_PESOS } },
    { header: "Estado", key: "estado", width: 14 },
  ];
  for (const p of inventario) {
    const estado = p.stock <= 0 ? "Agotado" : p.stock <= p.stockMinimo ? "Stock bajo" : "Disponible";
    const fila = hojaInventario.addRow({ ...p, codigo: p.codigo ?? "", valor: p.precio * Math.max(p.stock, 0), estado });
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

  return aArchivo(libro, `Reporte_${nombreSeguro(local.nombre)}_${sufijoPeriodo(anio, mes)}.xlsx`);
}

/* =================== Reporte consolidado (todos los locales) =================== */

export async function generarReporteConsolidado(anio: number, mes?: number) {
  const listaLocales = await listarLocales();
  const [estadisticas, cartera] = await Promise.all([
    Promise.all(listaLocales.map((l) => obtenerEstadisticas(l.id, anio))),
    obtenerCartera(),
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
  });
  nota(hoja, `Periodo: ${textoPeriodo(anio, mes)} · Créditos y saldo por cobrar al día de hoy · Generado: ${fechaHora(new Date())}`);

  /* ---------- Hoja 2: Cartera de todos los locales ---------- */
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
