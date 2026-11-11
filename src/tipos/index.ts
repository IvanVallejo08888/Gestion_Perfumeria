/**
 * Tipos de datos que viajan entre la API y las pantallas.
 * (Las fechas llegan al navegador como texto ISO.)
 */
import type { Clasificacion, Genero, Publico, Tamano, TipoProducto } from "@/lib/clasificacion";

export type { Clasificacion, Genero, Publico, Tamano, TipoProducto };

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

/** Producto del inventario. La clasificación es null en productos creados antes de clasificarlos. */
export interface Producto extends ProductoVenta {
  stockMinimo: number;
  marcaId: string | null;
  marcaNombre: string | null;
  tipo: TipoProducto | null;
  genero: Genero | null;
  publico: Publico | null;
  tamano: Tamano | null;
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

export interface GastoFila {
  id: string;
  categoriaNombre: string;
  descripcion: string | null;
  valor: number;
  medioPago: MedioPagoGasto;
  /** Día del gasto, "AAAA-MM-DD". */
  fecha: string;
  usuarioNombre: string;
  puedeEliminar: boolean;
}

export interface ListaGastos {
  gastos: GastoFila[];
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
