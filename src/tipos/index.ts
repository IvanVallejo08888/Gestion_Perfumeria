/**
 * Tipos de datos que viajan entre la API y las pantallas.
 * (Las fechas llegan al navegador como texto ISO.)
 */
import type { Categoria, Clasificacion, Concentracion, Genero, Publico, TipoProducto } from "@/lib/clasificacion";

import type { EstadoStock, FiltrosInventario, TipoMovimiento } from "@/lib/inventario";

export type { Categoria, Clasificacion, Concentracion, Genero, Publico, TipoProducto };
import type { CorteVenta } from "@/lib/dashboard";

export type { EstadoStock, FiltrosInventario, TipoMovimiento };
export type { CorteVenta };

export type Rol = "ADMIN" | "VENDEDOR";
export type EstadoUsuario = "PENDIENTE" | "ACTIVO" | "PAUSADO";
export type TipoFactura = "NORMAL" | "CREDITO";
export type EstadoFactura = "PENDIENTE" | "COMPLETADA";
export type MedioPago = "EFECTIVO" | "TRANSFERENCIA" | "MIXTO";
/** CREDITO = gasto a crédito: no sale de la caja ese día, crea una deuda que se paga en cuotas. */
export type MedioPagoGasto = "EFECTIVO" | "TRANSFERENCIA" | "CREDITO";
export type { EstadoDeuda } from "@/lib/deudas";
/** Cómo se pagó una compra de mercancía. CREDITO = cuenta por pagar al proveedor. */
export type MedioPagoCompra = "EFECTIVO" | "TRANSFERENCIA" | "CREDITO";
export type EstadoCuentaPagar = "PENDIENTE" | "SALDADA";

export interface ClienteDatos {
  identificacion: string;
  nombre: string;
  telefono: string;
  direccion: string;
  sector: string;
}

export interface ProductoVenta {
  id: string;
  /** Nombre COMPLETO para mostrar: "Creed Aventus · EDP 100 ml · Hombre". */
  nombre: string;
  codigo: string | null;
  precio: number;
  stock: number;
  /** Texto normalizado con todas las características (para filtrar en el navegador). */
  busqueda?: string;
}

/**
 * Producto del inventario. `nombre` es el nombre completo (para mostrar) y `fragancia` el nombre
 * que escribió la persona ("Aventus"). Las características son null si no se llenaron.
 */
export interface Producto extends ProductoVenta {
  fragancia: string;
  stockMinimo: number;
  marcaId: string | null;
  marcaNombre: string | null;
  variante: string | null;
  concentracion: Concentracion | null;
  contenidoMl: number | null;
  categoria: Categoria | null;
  tipo: TipoProducto | null;
  genero: Genero | null;
  publico: Publico | null;
}

/** Un cambio de stock (detalle del perfume). "cantidad" lleva signo: +5 entra, -2 sale. */
export interface MovimientoInventario {
  id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  stockResultante: number;
  usuarioNombre: string;
  /** Número de la factura cuando el movimiento es una VENTA. */
  facturaNumero: number | null;
  nota: string | null;
  creadoEn: string;
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

/**
 * Comprobante de un abono (lo que se le comparte al cliente).
 * totalAbonado y saldo son los de JUSTO DESPUÉS de este abono, no los de hoy:
 * así un comprobante antiguo sigue mostrando los valores de ese día.
 */
export interface ComprobanteAbono {
  id: string;
  /** Número del abono dentro de la factura (1, 2, 3…), en orden de fecha. */
  numero: number;
  valor: number;
  medioPago: MedioPago;
  valorEfectivo: number;
  valorTransferencia: number;
  creadoEn: string;
  /** El abono se anuló junto con la venta: el comprobante ya no vale. */
  anulado: boolean;
  /** Nombre de quien recibió el abono (null si ese usuario ya no existe). */
  recibidoPor: string | null;
  /** Suma de los abonos hasta este (incluido). */
  totalAbonado: number;
  /** Saldo que quedó después de este abono. */
  saldo: number;
  factura: {
    id: string;
    numero: number;
    total: number;
    clienteNombre: string;
    clienteIdentificacion: string;
    clienteTelefono: string;
  };
  local: { nombre: string; direccion: string | null; telefono: string | null };
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
  items: ({ id: string; nombreProducto: string; precioUnitario: number; cantidad: number; subtotal: number } & Clasificacion)[];
  cuotas: CuotaDetalle[];
  abonos: AbonoDetalle[];
}

/** Sector, marca o categoría de gasto: un nombre que se puede desactivar. */
export interface NombreActivo {
  id: string;
  nombre: string;
  activo: boolean;
}

/** Categoría de gasto: "personal" = gastos de la dueña (aparte, no se restan de la utilidad). */
export interface CategoriaGastoOpcion extends NombreActivo {
  personal: boolean;
}

export interface GastoFila {
  id: string;
  categoriaNombre: string;
  /** Gasto personal de la dueña: se muestra aparte y no se resta de la utilidad. */
  personal: boolean;
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
  /** Solo en gastos a crédito: la deuda que nació con este gasto. */
  deuda: GastoDeudaInfo | null;
}

/** Datos de la deuda que se muestran junto a un gasto a crédito (y en la confirmación de anularlo). */
export interface GastoDeudaInfo {
  id: string;
  acreedor: string;
  estado: import("@/lib/deudas").EstadoDeuda;
  saldo: number;
  /** Pagos vigentes (no anulados): si hay, el gasto no se puede anular hasta anularlos. */
  pagosVigentes: number;
  valorPagos: number;
}

export interface ListaGastos {
  /** Según el filtro: los gastos vigentes o los eliminados. */
  gastos: GastoFila[];
  /** Total de gastos del negocio (sin los personales). Los totales SIEMPRE son de los gastos vigentes del periodo (nunca suman los eliminados). */
  total: number;
  totalEfectivo: number;
  totalTransferencia: number;
  /** Total de gastos personales (no se restan de la utilidad). Incluye los pagos de deudas personales. */
  totalPersonales: number;
  /** Parte de "total" que son pagos de deudas hechos en el periodo (esos pagos no aparecen en la lista de gastos). */
  totalPagosDeudas: number;
}

export interface Notificacion {
  id: string;
  tipo: "COBRO" | "STOCK" | "DEUDA";
  nivel: "VENCIDA" | "HOY" | "PROXIMA" | "STOCK_AGOTADO" | "STOCK_BAJO";
  titulo: string;
  descripcion: string;
  fecha: string | null;
  /** Para cobros: identificación del cliente (abre directamente su crédito). */
  clienteIdentificacion?: string;
  /** Para pagos de deudas: la deuda (el botón «Ir a pagar» abre directamente su ventana de pago). */
  deudaId?: string;
  /** Para pagos de deudas: a quién se le debe y cuánto falta de la cuota (para el aviso del navegador). */
  acreedor?: string;
  valor?: number;
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
  /** Gastos del negocio (sin los personales) = gastos de contado + pagos de deudas del mes. */
  gastos: number;
  /** Parte de "gastos" que son pagos de deudas del negocio. */
  pagosDeudas: number;
  /** Informativo: valor de las deudas adquiridas (gastos a crédito) en el mes. NO se resta de la utilidad. */
  deudasAdquiridas: number;
  /** Gastos personales de la dueña: se informan aparte y no se restan. */
  gastosPersonales: number;
  /** Recibido − gastos del negocio. */
  utilidad: number;
}

export interface Estadisticas {
  local: { id: string; nombre: string };
  anio: number;
  meses: MesEstadistica[];
  totales: Omit<MesEstadistica, "mes" | "nombre">;
  topProductos: { nombre: string; cantidad: number; total: number }[];
  creditosPendientes: { cantidad: number; saldo: number };
  /** Deudas del negocio por pagar HOY (saldo total), sin importar el periodo elegido. */
  deudasPorPagar: { cantidad: number; saldo: number };
}

/* --------------------------------- Deudas --------------------------------- */

export interface DeudaCuotaFila {
  id: string;
  numero: number;
  fechaVencimiento: string;
  valor: number;
  valorPagado: number;
  estado: "PENDIENTE" | "PAGADA";
  pagadaEn: string | null;
}

export interface DeudaPagoFila {
  id: string;
  fecha: string;
  valor: number;
  medioPago: MedioPago;
  valorEfectivo: number;
  valorTransferencia: number;
  nota: string | null;
  usuarioNombre: string;
  anulado: boolean;
  anuladoEn: string | null;
  anuladoPorNombre: string | null;
  motivoAnulacion: string | null;
}

/** Deuda en la lista de la pestaña «Deudas». */
export interface DeudaResumen {
  id: string;
  gastoId: string;
  acreedor: string;
  descripcion: string | null;
  categoriaNombre: string;
  personal: boolean;
  /** Día en que se adquirió la deuda (fecha del gasto), "AAAA-MM-DD". */
  fecha: string;
  valorTotal: number;
  pagado: number;
  saldo: number;
  estado: import("@/lib/deudas").EstadoDeuda;
  totalCuotas: number;
  cuotasPagadas: number;
  /** Próxima cuota pendiente (null si ya no hay). */
  proximaCuota: { numero: number; fechaVencimiento: string; pendiente: number } | null;
  pagadaEn: string | null;
  resumenMedioPago: MedioPago | null;
}

export interface DeudaDetalle extends DeudaResumen {
  cuotas: DeudaCuotaFila[];
  /** Todos los pagos (también los anulados, marcados). */
  pagos: DeudaPagoFila[];
  /** Suma de los pagos vigentes por medio. */
  totalEfectivo: number;
  totalTransferencia: number;
  creadoPorNombre: string;
  creadoEn: string;
  anuladaEn: string | null;
  anuladaPorNombre: string | null;
  motivoAnulacion: string | null;
}

export interface ListaDeudas {
  deudas: DeudaResumen[];
  /** Resumen de las deudas PENDIENTES del local (no depende del filtro). */
  resumen: {
    totalAdeudado: number;
    cantidadPendientes: number;
    cuotasVencidas: number;
    proximoPago: { deudaId: string; acreedor: string; fechaVencimiento: string; valor: number } | null;
  };
}

/* ------------------------------- Caja del día ------------------------------- */

export type { MovimientoCaja, ResumenCaja, TipoMovimientoCaja } from "@/lib/caja";

export interface CajaDia {
  /** "AAAA-MM-DD" */
  fecha: string;
  resumen: import("@/lib/caja").ResumenCaja;
  movimientos: import("@/lib/caja").MovimientoCaja[];
  /** Informativo: pagos a proveedores por compras de mercancía (NO se restan del saldo). */
  pagosProveedores: { dia: string; hora: string | null; descripcion: string; efectivo: number; transferencia: number }[];
  totalPagosProveedores: number;
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

/* -------------------------------- Dashboard -------------------------------- */

export interface ProductoTop {
  nombre: string;
  unidades: number;
  valor: number;
}

/** Un mes de la gráfica "contado vs crédito" (recaudo = contado + abonos recibidos). */
export interface MesDashboard {
  mes: number;
  nombre: string;
  contado: number;
  credito: number;
  recaudo: number;
}

/** Perfume agotado o con stock bajo (lista del dashboard). */
export interface ProductoCritico {
  id: string;
  nombre: string;
  marcaNombre: string | null;
  stock: number;
  stockMinimo: number;
  /** Solo en el consolidado del administrador. */
  localNombre: string | null;
}

/**
 * Dashboard de reportes. Ventas → periodo elegido (año o mes), tomadas de la copia guardada
 * en cada factura. Inventario, cartera y agotados → al día de hoy.
 */
export interface Dashboard {
  /** localId null = consolidado de todos los locales (solo administrador). */
  alcance: { localId: string | null; localNombre: string };
  anio: number;
  mes: number | null;
  kpis: {
    totalVendido: number;
    recaudado: number;
    unidadesVendidas: number;
    valorInventario: number;
    carteraPendiente: number;
    creditosPendientes: number;
    perfumesAgotados: number;
  };
  topPorUnidades: ProductoTop[];
  topPorValor: ProductoTop[];
  porPublico: CorteVenta[];
  porTipo: CorteVenta[];
  /** Top 8 + "Otras". */
  porMarca: CorteVenta[];
  porTamano: CorteVenta[];
  /** Siempre los 12 meses del año elegido. */
  meses: MesDashboard[];
  inventario: {
    porPublico: { clave: string; etiqueta: string; unidades: number }[];
    criticos: ProductoCritico[];
    /** Total de perfumes agotados o en stock bajo (la lista muestra solo los más urgentes). */
    totalCriticos: number;
  };
}

/* ------------------------- Proveedores y cuentas por pagar ------------------------- */

export interface Proveedor {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  /** Texto libre: qué productos surte. */
  productosSurte: string | null;
  activo: boolean;
  /** Lo que se le debe hoy (suma de saldos de compras a crédito pendientes). */
  deuda: number;
  comprasPendientes: number;
}

export interface AbonoProveedorDetalle {
  id: string;
  valor: number;
  medioPago: MedioPago;
  valorEfectivo: number;
  valorTransferencia: number;
  /** Día del pago, "AAAA-MM-DD". */
  fecha: string;
  usuarioNombre: string;
  nota: string | null;
}

export interface CompraProveedor {
  id: string;
  productoNombre: string;
  cantidad: number;
  total: number;
  medioPago: MedioPagoCompra;
  saldo: number;
  estado: EstadoCuentaPagar;
  usuarioNombre: string;
  nota: string | null;
  creadoEn: string;
  saldadaEn: string | null;
  abonos: AbonoProveedorDetalle[];
}

export interface ProveedorDetalle extends Proveedor {
  compras: CompraProveedor[];
  /** Total pagado en abonos a compras a crédito. */
  totalAbonado: number;
}
