/**
 * Generación de reportes en Excel (.xlsx) por local:
 *  - Reporte ANUAL: hoja "Resumen por mes", hoja "Facturas", hoja "Productos vendidos" y hoja "Abonos".
 *  - Reporte MENSUAL: las mismas hojas, solo con los datos del mes elegido.
 */
import "server-only";
import ExcelJS from "exceljs";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { abonos, facturaItems, facturas } from "@/db/schema";
import { fechaHora, MESES, numeroFactura, rangoPeriodo } from "@/lib/formato";
import { obtenerEstadisticas } from "./estadisticas";
import { obtenerLocal } from "./locales";

const FORMATO_PESOS = '"$"#,##0';
const COLOR_ENCABEZADO = "FF1E3A8A"; // azul oscuro

/** Aplica estilo a la fila de títulos de una hoja. */
function estilizarEncabezado(hoja: ExcelJS.Worksheet) {
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ENCABEZADO } };
  fila.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  fila.height = 28;
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columnCount } };
}

export async function generarReporteExcel(localId: string, anio: number, mes?: number) {
  const local = await obtenerLocal(localId);
  const { inicio, fin } = rangoPeriodo(anio, mes);
  const periodo = mes ? `${MESES[mes - 1]} ${anio}` : `Año ${anio}`;
  const enPeriodo = and(eq(facturas.localId, localId), gte(facturas.creadoEn, inicio), lt(facturas.creadoEn, fin));

  const [estadisticas, listaFacturas, productosVendidos, listaAbonos] = await Promise.all([
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
        nota: abonos.nota,
        numero: facturas.numero,
        cliente: facturas.clienteNombre,
        identificacion: facturas.clienteIdentificacion,
      })
      .from(abonos)
      .innerJoin(facturas, eq(abonos.facturaId, facturas.id))
      .where(and(eq(facturas.localId, localId), gte(abonos.creadoEn, inicio), lt(abonos.creadoEn, fin)))
      .orderBy(asc(abonos.creadoEn)),
  ]);

  const libro = new ExcelJS.Workbook();
  libro.creator = "Gestión de Perfumerías";
  libro.created = new Date();

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
  ];
  const mesesIncluidos = mes ? estadisticas.meses.filter((m) => m.mes === mes) : estadisticas.meses;
  resumen.addRows(mesesIncluidos);
  if (!mes) {
    const filaTotal = resumen.addRow({ nombre: "TOTAL AÑO", ...estadisticas.totales });
    filaTotal.font = { bold: true };
    filaTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
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
    })),
  );
  estilizarEncabezado(hojaFacturas);

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
    { header: "Nota", key: "nota", width: 30 },
  ];
  hojaAbonos.addRows(
    listaAbonos.map((a) => ({ ...a, fecha: fechaHora(a.creadoEn), numero: numeroFactura(a.numero), nota: a.nota ?? "" })),
  );
  estilizarEncabezado(hojaAbonos);

  const buffer = await libro.xlsx.writeBuffer();
  const nombreSeguro = local.nombre.replace(/[^\p{L}\p{N}]+/gu, "_");
  const nombreArchivo = mes
    ? `Reporte_${nombreSeguro}_${anio}-${String(mes).padStart(2, "0")}.xlsx`
    : `Reporte_${nombreSeguro}_${anio}.xlsx`;

  return { buffer: Buffer.from(buffer as ArrayBuffer), nombreArchivo };
}
