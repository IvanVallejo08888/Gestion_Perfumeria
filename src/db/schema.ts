/**
 * ============================================================
 *  Esquema de base de datos — Gestión de Perfumerías
 *  Motor: PostgreSQL · ORM: Drizzle
 *
 *  Notas de diseño:
 *  - El dinero se guarda como ENTERO (pesos colombianos, sin decimales).
 *  - Las facturas guardan una copia (snapshot) de los datos del cliente y
 *    de los productos, para que el historial no cambie si luego se editan.
 * ============================================================
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ---------------------------- Enumeraciones ---------------------------- */

/** Solo existe UN administrador; el resto son vendedores. */
export const rolEnum = pgEnum("rol", ["ADMIN", "VENDEDOR"]);

/**
 * PENDIENTE: se registró y espera que el administrador le asigne un local.
 * ACTIVO:    puede iniciar sesión y trabajar.
 * PAUSADO:   el administrador suspendió temporalmente su acceso.
 */
export const estadoUsuarioEnum = pgEnum("estado_usuario", ["PENDIENTE", "ACTIVO", "PAUSADO"]);

/** NORMAL = venta de contado · CREDITO = venta a cuotas. */
export const tipoFacturaEnum = pgEnum("tipo_factura", ["NORMAL", "CREDITO"]);

/** PENDIENTE = crédito con saldo · COMPLETADA = pagada en su totalidad. */
export const estadoFacturaEnum = pgEnum("estado_factura", ["PENDIENTE", "COMPLETADA"]);

export const estadoCuotaEnum = pgEnum("estado_cuota", ["PENDIENTE", "PAGADA"]);

/* Columnas de fecha reutilizables (con zona horaria) */
const creadoEn = () => timestamp("creado_en", { withTimezone: true }).notNull().defaultNow();
const actualizadoEn = () =>
  timestamp("actualizado_en", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* -------------------------------- Tablas -------------------------------- */

export const locales = pgTable("locales", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull().unique(),
  direccion: text("direccion"),
  telefono: text("telefono"),
  activo: boolean("activo").notNull().default(true),
  /** Contador para el número consecutivo de facturas del local. */
  consecutivoFactura: integer("consecutivo_factura").notNull().default(0),
  creadoEn: creadoEn(),
  actualizadoEn: actualizadoEn(),
});

export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    identificacion: text("identificacion").notNull().unique(),
    correo: text("correo").notNull().unique(),
    telefono: text("telefono").notNull(),
    passwordHash: text("password_hash").notNull(),
    rol: rolEnum("rol").notNull().default("VENDEDOR"),
    estado: estadoUsuarioEnum("estado").notNull().default("PENDIENTE"),
    /** Se incrementa al cambiar contraseña o pausar: invalida las sesiones abiertas. */
    versionSesion: integer("version_sesion").notNull().default(0),
    localId: uuid("local_id").references(() => locales.id, { onDelete: "set null" }),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [index("usuarios_local_idx").on(t.localId), index("usuarios_estado_idx").on(t.estado)],
);

export const productos = pgTable(
  "productos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localId: uuid("local_id")
      .notNull()
      .references(() => locales.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    /** Nombre en minúsculas y sin tildes: permite la búsqueda inteligente. */
    nombreBusqueda: text("nombre_busqueda").notNull(),
    codigo: text("codigo"),
    precio: integer("precio").notNull(),
    stock: integer("stock").notNull().default(0),
    /** Si el stock llega a este número o menos, se genera una notificación. */
    stockMinimo: integer("stock_minimo").notNull().default(3),
    activo: boolean("activo").notNull().default(true),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [
    uniqueIndex("productos_local_codigo_uq").on(t.localId, t.codigo),
    index("productos_busqueda_idx").on(t.localId, t.nombreBusqueda),
  ],
);

export const clientes = pgTable(
  "clientes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localId: uuid("local_id")
      .notNull()
      .references(() => locales.id, { onDelete: "cascade" }),
    identificacion: text("identificacion").notNull(),
    nombre: text("nombre").notNull(),
    telefono: text("telefono").notNull(),
    direccion: text("direccion").notNull(),
    sector: text("sector").notNull(),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [uniqueIndex("clientes_local_ident_uq").on(t.localId, t.identificacion)],
);

export const facturas = pgTable(
  "facturas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    numero: integer("numero").notNull(),
    tipo: tipoFacturaEnum("tipo").notNull(),
    estado: estadoFacturaEnum("estado").notNull(),
    localId: uuid("local_id")
      .notNull()
      .references(() => locales.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    vendedorNombre: text("vendedor_nombre").notNull(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    // Copia de los datos del cliente en el momento de la venta
    clienteIdentificacion: text("cliente_identificacion").notNull(),
    clienteNombre: text("cliente_nombre").notNull(),
    clienteTelefono: text("cliente_telefono").notNull(),
    clienteDireccion: text("cliente_direccion").notNull(),
    clienteSector: text("cliente_sector").notNull(),
    subtotal: integer("subtotal").notNull(),
    adicional: integer("adicional").notNull().default(0),
    descuento: integer("descuento").notNull().default(0),
    total: integer("total").notNull(),
    /** Lo que falta por pagar (0 en ventas de contado). */
    saldo: integer("saldo").notNull().default(0),
    notas: text("notas"),
    creadoEn: creadoEn(),
    completadaEn: timestamp("completada_en", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("facturas_local_numero_uq").on(t.localId, t.numero),
    index("facturas_local_fecha_idx").on(t.localId, t.creadoEn),
    index("facturas_local_estado_idx").on(t.localId, t.estado),
    index("facturas_cliente_ident_idx").on(t.clienteIdentificacion),
  ],
);

export const facturaItems = pgTable("factura_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  facturaId: uuid("factura_id")
    .notNull()
    .references(() => facturas.id, { onDelete: "cascade" }),
  productoId: uuid("producto_id").references(() => productos.id, { onDelete: "set null" }),
  nombreProducto: text("nombre_producto").notNull(),
  precioUnitario: integer("precio_unitario").notNull(),
  cantidad: integer("cantidad").notNull(),
  subtotal: integer("subtotal").notNull(),
});

export const cuotas = pgTable(
  "cuotas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facturaId: uuid("factura_id")
      .notNull()
      .references(() => facturas.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    fechaVencimiento: timestamp("fecha_vencimiento", { withTimezone: true }).notNull(),
    valor: integer("valor").notNull(),
    valorPagado: integer("valor_pagado").notNull().default(0),
    estado: estadoCuotaEnum("estado").notNull().default("PENDIENTE"),
    pagadaEn: timestamp("pagada_en", { withTimezone: true }),
  },
  (t) => [index("cuotas_estado_fecha_idx").on(t.estado, t.fechaVencimiento)],
);

export const abonos = pgTable(
  "abonos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facturaId: uuid("factura_id")
      .notNull()
      .references(() => facturas.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    valor: integer("valor").notNull(),
    nota: text("nota"),
    creadoEn: creadoEn(),
  },
  (t) => [index("abonos_factura_idx").on(t.facturaId)],
);

/* ------------------------------ Relaciones ------------------------------ */
/* Permiten consultas anidadas con db.query.<tabla>.findMany({ with: {...} }) */

export const localesRelations = relations(locales, ({ many }) => ({
  usuarios: many(usuarios),
  productos: many(productos),
  clientes: many(clientes),
  facturas: many(facturas),
}));

export const usuariosRelations = relations(usuarios, ({ one }) => ({
  local: one(locales, { fields: [usuarios.localId], references: [locales.id] }),
}));

export const productosRelations = relations(productos, ({ one }) => ({
  local: one(locales, { fields: [productos.localId], references: [locales.id] }),
}));

export const clientesRelations = relations(clientes, ({ one, many }) => ({
  local: one(locales, { fields: [clientes.localId], references: [locales.id] }),
  facturas: many(facturas),
}));

export const facturasRelations = relations(facturas, ({ one, many }) => ({
  local: one(locales, { fields: [facturas.localId], references: [locales.id] }),
  cliente: one(clientes, { fields: [facturas.clienteId], references: [clientes.id] }),
  items: many(facturaItems),
  cuotas: many(cuotas),
  abonos: many(abonos),
}));

export const facturaItemsRelations = relations(facturaItems, ({ one }) => ({
  factura: one(facturas, { fields: [facturaItems.facturaId], references: [facturas.id] }),
}));

export const cuotasRelations = relations(cuotas, ({ one }) => ({
  factura: one(facturas, { fields: [cuotas.facturaId], references: [facturas.id] }),
}));

export const abonosRelations = relations(abonos, ({ one }) => ({
  factura: one(facturas, { fields: [abonos.facturaId], references: [facturas.id] }),
}));

/* ------------------------------ Tipos útiles ----------------------------- */
export type Usuario = typeof usuarios.$inferSelect;
export type Local = typeof locales.$inferSelect;
export type Producto = typeof productos.$inferSelect;
export type Cliente = typeof clientes.$inferSelect;
export type Factura = typeof facturas.$inferSelect;
export type FacturaItem = typeof facturaItems.$inferSelect;
export type Cuota = typeof cuotas.$inferSelect;
export type Abono = typeof abonos.$inferSelect;
