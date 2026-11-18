/**
 * Tipos de datos que viajan entre la API y las pantallas.
 * (Las fechas llegan al navegador como texto ISO.)
 */

export type Rol = "ADMIN" | "VENDEDOR";
export type EstadoUsuario = "PENDIENTE" | "ACTIVO" | "PAUSADO";
export type TipoFactura = "NORMAL" | "CREDITO";
export type EstadoFactura = "PENDIENTE" | "COMPLETADA";
export type MedioPago = "EFECTIVO" | "TRANSFERENCIA" | "MIXTO";
export type MedioPagoGasto = "EFECTIVO" | "TRANSFERENCIA";

export interface ClienteDatos {
  identificacion: string;
  nombre: string;
  telefono: string;
  direccion: string;
  sector: string;
}

export interface ProductoVenta {
  id: string;
  nombre: string;
  codigo: string | null;
  precio: number;
  stock: number;
}

export interface Producto extends ProductoVenta {
  stockMinimo: number;
}

export interface CuotaDetalle {
  id: string;
  numero: number;
  fechaVencimiento: string;
  valor: number;
  valorPagado: number;
  estado: "PENDIENTE" | "PAGADA";
  pagadaEn: string | null;
}

export interface AbonoDetalle {
  id: string;
  valor: number;
  medioPago: MedioPago;
  valorEfectivo: number;
  valorTransferencia: number;
  nota: string | null;
  creadoEn: string;
}

export interface FacturaResumen {
  id: string;
  numero: number;
  tipo: TipoFactura;
  estado: EstadoFactura;
  clienteNombre: string;
  clienteIdentificacion: string;
  total: number;
  saldo: number;
  /** Vacío en los créditos: el dinero entra con cada abono. */
  medioPago: MedioPago | null;
  valorEfectivo: number;
  valorTransferencia: number;
  creadoEn: string;
  completadaEn: string | null;
  /** Venta eliminada (anulada): se conserva para el historial, pero no cuenta en ningún total. */
  anulada: boolean;
  anuladaEn: string | null;
  anuladaPorNombre: string | null;
  motivoAnulacion: string | null;
}

/** Resultado de anular una venta (para avisar qué productos regresaron al inventario). */
export interface ResultadoAnulacion {
  devueltos: { nombre: string; cantidad: number }[];
  /** Productos que ya no existen en el inventario: no se pudo devolver su cantidad. */
  omitidos: { nombre: string; cantidad: number }[];
  /** Suma de los abonos que quedaron anulados (créditos). */
  abonosAnulados: number;
}

export interface FacturaDetalle extends FacturaResumen {
  clienteTelefono: string;
  clienteDireccion: string;
  clienteSector: string;
  vendedorNombre: string;
  subtotal: number;
  adicional: number;
  descuento: number;
  notas: string | null;
  local: { nombre: string; direccion: string | null; telefono: string | null };
  items: { id: string; nombreProducto: string; precioUnitario: number; cantidad: number; subtotal: number }[];
  cuotas: CuotaDetalle[];
  abonos: AbonoDetalle[];
}

/** Sector o categoría de gasto: un nombre que se puede desactivar. */
export interface NombreActivo {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface GastoFila {
  id: string;
  categoriaNombre: string;
  descripcion: string | null;
  valor: number;
  medioPago: MedioPagoGasto;
  /** Día del gasto, "AAAA-MM-DD". */
  fecha: string;
  usuarioNombre: string;
  /** Gasto eliminado (anulado): se conserva para el registro, pero no cuenta en los totales. */
  anulado: boolean;
  anuladoEn: string | null;
  anuladoPorNombre: string | null;
  motivoAnulacion: string | null;
}

export interface ListaGastos {
  /** Según el filtro: los gastos vigentes o los eliminados. */
  gastos: GastoFila[];
  /** Los totales SIEMPRE son de los gastos vigentes del periodo (nunca suman los eliminados). */
  total: number;
  totalEfectivo: number;
  totalTransferencia: number;
}

export interface Notificacion {
  id: string;
  tipo: "COBRO" | "STOCK";
  nivel: "VENCIDA" | "HOY" | "PROXIMA" | "STOCK_AGOTADO" | "STOCK_BAJO";
  titulo: string;
  descripcion: string;
  fecha: string | null;
  /** Para cobros: identificación del cliente (abre directamente su crédito). */
  clienteIdentificacion?: string;
}

export interface MesEstadistica {
  mes: number;
  nombre: string;
  cantidadContado: number;
  ventasContado: number;
  cantidadCredito: number;
  ventasCredito: number;
  recaudoAbonos: number;
  totalVentas: number;
  totalRecaudado: number;
  /** Dinero recibido por medio de pago (contado + abonos). */
  recibidoEfectivo: number;
  recibidoTransferencia: number;
  gastos: number;
  /** Recibido − gastos. */
  utilidad: number;
}

export interface Estadisticas {
  local: { id: string; nombre: string };
  anio: number;
  meses: MesEstadistica[];
  totales: Omit<MesEstadistica, "mes" | "nombre">;
  topProductos: { nombre: string; cantidad: number; total: number }[];
  creditosPendientes: { cantidad: number; saldo: number };
}

/* --------------------------------- Clientes -------------------------------- */

/** Cliente en la lista paginada, con sus totales (sin contar ventas anuladas). */
export interface ClienteFila {
  id: string;
  identificacion: string;
  nombre: string;
  telefono: string;
  sector: string;
  compras: number;
  totalComprado: number;
  saldoPendiente: number;
  ultimaCompra: string | null;
}

export interface ListaClientes {
  clientes: ClienteFila[];
  total: number;
  pagina: number;
  totalPaginas: number;
  /** Id del cliente cuya cédula o teléfono coincide EXACTAMENTE con lo buscado (si es uno solo). */
  coincidenciaExacta: string | null;
}

export interface ClienteDetalle extends ClienteDatos {
  id: string;
  creadoEn: string;
}

/** Resumen del récord del cliente. Los totales NO incluyen las ventas anuladas. */
export interface ResumenCliente {
  comprasContado: number;
  comprasCredito: number;
  totalComprado: number;
  totalPagado: number;
  saldoPendiente: number;
  creditosPendientes: number;
  primeraCompra: string | null;
  ultimaCompra: string | null;
  productoFavorito: { nombre: string; cantidad: number } | null;
  /** Ventas anuladas, aparte (no suman en los totales). */
  anuladas: { cantidad: number; total: number };
}

export interface ListaFacturasCliente {
  facturas: FacturaResumen[];
  total: number;
  pagina: number;
  totalPaginas: number;
}
