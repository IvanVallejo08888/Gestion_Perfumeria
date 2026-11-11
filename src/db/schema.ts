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
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { GENEROS, PUBLICOS, TAMANOS, TIPOS_PRODUCTO } from "../lib/clasificacion";

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

/** Cómo se recibió el dinero de una factura o de un abono. MIXTO = parte efectivo, parte transferencia. */
export const medioPagoEnum = pgEnum("medio_pago", ["EFECTIVO", "TRANSFERENCIA", "MIXTO"]);

/** Cómo se pagó un gasto (los gastos no se dividen entre dos medios). */
export const medioPagoGastoEnum = pgEnum("medio_pago_gasto", ["EFECTIVO", "TRANSFERENCIA"]);

/* Clasificación de perfumes (las listas y sus etiquetas están en src/lib/clasificacion.ts) */
export const tipoProductoEnum = pgEnum("tipo_producto", TIPOS_PRODUCTO);
export const generoEnum = pgEnum("genero", GENEROS);
/** ADULTO o INFANTIL. Hombre + Infantil = niño · Mujer + Infantil = niña. */
export const publicoEnum = pgEnum("publico", PUBLICOS);
/** Tamaño en onzas como enum: solo se aceptan los tamaños de la lista, sin riesgo de decimales. */
export const tamanoProductoEnum = pgEnum("tamano_producto", TAMANOS);

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

/** Sectores de la ciudad que el administrador define para cada local. */
export const sectores = pgTable(
  "sectores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localId: uuid("local_id")
      .notNull()
      .references(() => locales.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    /** Un sector ya usado en facturas no se borra: solo se desactiva. */
    activo: boolean("activo").notNull().default(true),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex("sectores_local_nombre_uq").on(t.localId, sql`lower(${t.nombre})`)],
);

/** Marcas (casas de perfume) de cada local. Una marca usada en productos no se borra: solo se desactiva. */
export const marcas = pgTable(
  "marcas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localId: uuid("local_id")
      .notNull()
      .references(() => locales.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex("marcas_local_nombre_uq").on(t.localId, sql`lower(${t.nombre})`)],
);

/** Categorías de gastos de cada local (Arriendo, Nómina…). */
export const categoriasGasto = pgTable(
  "categorias_gasto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localId: uuid("local_id")
      .notNull()
      .references(() => locales.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [uniqueIndex("categorias_gasto_local_nombre_uq").on(t.localId, sql`lower(${t.nombre})`)],
);

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
    /*
     * Clasificación. Son opcionales en la base de datos para que los productos
     * creados antes de la clasificación sigan funcionando ("Sin categoría").
     * Al crear o editar un producto, la validación las exige.
     */
    marcaId: uuid("marca_id").references(() => marcas.id, { onDelete: "restrict" }),
    tipo: tipoProductoEnum("tipo"),
    genero: generoEnum("genero"),
    publico: publicoEnum("publico"),
    tamano: tamanoProductoEnum("tamano"),
    activo: boolean("activo").notNull().default(true),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [
    uniqueIndex("productos_local_codigo_uq").on(t.localId, t.codigo),
    index("productos_busqueda_idx").on(t.localId, t.nombreBusqueda),
    index("productos_marca_idx").on(t.marcaId),
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
    /** Nombre del cliente normalizado (sin tildes ni signos), para la búsqueda del historial. */
    clienteNombreBusqueda: text("cliente_nombre_busqueda").notNull().default(""),
    clienteTelefono: text("cliente_telefono").notNull(),
    clienteDireccion: text("cliente_direccion").notNull(),
    clienteSector: text("cliente_sector").notNull(),
    subtotal: integer("subtotal").notNull(),
    adicional: integer("adicional").notNull().default(0),
    descuento: integer("descuento").notNull().default(0),
    total: integer("total").notNull(),
    /** Lo que falta por pagar (0 en ventas de contado). */
    saldo: integer("saldo").notNull().default(0),
    /**
     * Medio de pago de la venta de contado. En los créditos queda vacío (null),
     * porque el dinero entra después con cada abono, y cada abono guarda su propio medio.
     */
    medioPago: medioPagoEnum("medio_pago"),
    valorEfectivo: integer("valor_efectivo").notNull().default(0),
    valorTransferencia: integer("valor_transferencia").notNull().default(0),
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
  // Copia de la clasificación al momento de la venta (null en facturas anteriores → "Sin categoría")
  marcaNombre: text("marca_nombre"),
  tipo: tipoProductoEnum("tipo"),
  genero: generoEnum("genero"),
  publico: publicoEnum("publico"),
  tamano: tamanoProductoEnum("tamano"),
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
    medioPago: medioPagoEnum("medio_pago").notNull().default("EFECTIVO"),
    valorEfectivo: integer("valor_efectivo").notNull().default(0),
    valorTransferencia: integer("valor_transferencia").notNull().default(0),
    nota: text("nota"),
    creadoEn: creadoEn(),
  },
  (t) => [index("abonos_factura_idx").on(t.facturaId)],
);

export const gastos = pgTable(
  "gastos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localId: uuid("local_id")
      .notNull()
      .references(() => locales.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    // Copias (snapshot): el historial no cambia si luego se renombra la categoría o el usuario
    usuarioNombre: text("usuario_nombre").notNull(),
    categoriaId: uuid("categoria_id").references(() => categoriasGasto.id, { onDelete: "set null" }),
    categoriaNombre: text("categoria_nombre").notNull(),
    descripcion: text("descripcion"),
    valor: integer("valor").notNull(),
    medioPago: medioPagoGastoEnum("medio_pago").notNull(),
    /** Día del gasto (sin hora), en formato AAAA-MM-DD. */
    fecha: date("fecha", { mode: "string" }).notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [index("gastos_local_fecha_idx").on(t.localId, t.fecha)],
);

/* ------------------------------ Relaciones ------------------------------ */
/* Permiten consultas anidadas con db.query.<tabla>.findMany({ with: {...} }) */

export const localesRelations = relations(locales, ({ many }) => ({
  usuarios: many(usuarios),
  productos: many(productos),
  clientes: many(clientes),
  facturas: many(facturas),
  sectores: many(sectores),
  marcas: many(marcas),
  categoriasGasto: many(categoriasGasto),
  gastos: many(gastos),
}));

export const sectoresRelations = relations(sectores, ({ one }) => ({
  local: one(locales, { fields: [sectores.localId], references: [locales.id] }),
}));

export const marcasRelations = relations(marcas, ({ one, many }) => ({
  local: one(locales, { fields: [marcas.localId], references: [locales.id] }),
  productos: many(productos),
}));

export const categoriasGastoRelations = relations(categoriasGasto, ({ one }) => ({
  local: one(locales, { fields: [categoriasGasto.localId], references: [locales.id] }),
}));

export const gastosRelations = relations(gastos, ({ one }) => ({
  local: one(locales, { fields: [gastos.localId], references: [locales.id] }),
  categoria: one(categoriasGasto, { fields: [gastos.categoriaId], references: [categoriasGasto.id] }),
}));

export const usuariosRelations = relations(usuarios, ({ one }) => ({
  local: one(locales, { fields: [usuarios.localId], references: [locales.id] }),
}));

export const productosRelations = relations(productos, ({ one }) => ({
  local: one(locales, { fields: [productos.localId], references: [locales.id] }),
  marca: one(marcas, { fields: [productos.marcaId], references: [marcas.id] }),
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
export type Sector = typeof sectores.$inferSelect;
export type Marca = typeof marcas.$inferSelect;
export type CategoriaGasto = typeof categoriasGasto.$inferSelect;
export type Gasto = typeof gastos.$inferSelect;
