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
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { CATEGORIAS, CONCENTRACIONES, GENEROS, PUBLICOS, TIPOS_PRODUCTO } from "../lib/clasificacion";
import { TIPOS_MOVIMIENTO } from "../lib/inventario";
import { ALCANCES_LIMPIEZA, type ConteosLimpieza } from "../lib/limpieza";

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
export const concentracionEnum = pgEnum("concentracion", CONCENTRACIONES);
export const categoriaProductoEnum = pgEnum("categoria_producto", CATEGORIAS);

/** INGRESO = llegó mercancía · VENTA = salió en una factura · AJUSTE = corrección manual (con motivo). */
export const tipoMovimientoEnum = pgEnum("tipo_movimiento", TIPOS_MOVIMIENTO);

/** Cómo se pagó una compra de mercancía. CREDITO = queda debiéndole al proveedor (cuenta por pagar). */
export const medioPagoCompraEnum = pgEnum("medio_pago_compra", ["EFECTIVO", "TRANSFERENCIA", "CREDITO"]);

/** PENDIENTE = se le debe algo al proveedor · SALDADA = pagada en su totalidad. */
export const estadoCuentaPagarEnum = pgEnum("estado_cuenta_pagar", ["PENDIENTE", "SALDADA"]);

/** Qué borró una limpieza del sistema (ver src/lib/limpieza.ts). */
export const alcanceLimpiezaEnum = pgEnum("alcance_limpieza", ALCANCES_LIMPIEZA);

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

/**
 * Categorías de gastos de cada local (Nómina, Servicios públicos…).
 * "personal" = gastos propios de la dueña: se ven aparte y NO se restan de la utilidad.
 */
export const categoriasGasto = pgTable(
  "categorias_gasto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localId: uuid("local_id")
      .notNull()
      .references(() => locales.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
    personal: boolean("personal").notNull().default(false),
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
    /*
     * Características del producto (todas opcionales): con ellas se arma el nombre completo
     * "Creed Aventus · EDP 100 ml · Hombre" (ver armarNombreProducto en src/lib/productos.ts).
     */
    /** "Intense", "Blush", "Tester", "+ gel"… */
    variante: text("variante"),
    concentracion: concentracionEnum("concentracion"),
    /** Contenido en mililitros. Vacío si no se mide en ml (estuche, accesorio). */
    contenidoMl: integer("contenido_ml"),
    categoria: categoriaProductoEnum("categoria"),
    /** Nombre completo calculado en el servidor (nunca lo escribe el usuario). */
    nombreCompleto: text("nombre_completo").notNull().default(""),
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
    /*
     * Columnas para el buscador de clientes (se recalculan en cada inserción y edición):
     *  - nombreBusqueda: nombre con normalizarTexto ("José Núñez" → "jose nunez").
     *  - nombreCompacto: el mismo nombre sin espacios ("josenunez").
     *  - telefonoDigitos: solo los dígitos del teléfono, sin el 57 si tiene 12 dígitos.
     * El índice GIN de similitud (pg_trgm) se crea a mano en la migración 0002,
     * porque solo se puede crear si el servidor permite la extensión.
     */
    nombreBusqueda: text("nombre_busqueda").notNull().default(""),
    nombreCompacto: text("nombre_compacto").notNull().default(""),
    telefonoDigitos: text("telefono_digitos").notNull().default(""),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [
    uniqueIndex("clientes_local_ident_uq").on(t.localId, t.identificacion),
    index("clientes_local_nombre_busqueda_idx").on(t.localId, t.nombreBusqueda),
    index("clientes_local_telefono_idx").on(t.localId, t.telefonoDigitos),
  ],
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
    /*
     * Anulación ("Eliminar venta"): la factura NO se borra, solo se marca.
     * Una factura anulada no cuenta en estadísticas, reportes, créditos ni notificaciones.
     */
    anulada: boolean("anulada").notNull().default(false),
    anuladaEn: timestamp("anulada_en", { withTimezone: true }),
    anuladaPorId: uuid("anulada_por_id").references(() => usuarios.id, { onDelete: "set null" }),
    /** Copia del nombre de quien anuló (se conserva aunque el usuario se elimine). */
    anuladaPorNombre: text("anulada_por_nombre"),
    motivoAnulacion: text("motivo_anulacion"),
  },
  (t) => [
    uniqueIndex("facturas_local_numero_uq").on(t.localId, t.numero),
    index("facturas_local_anulada_idx").on(t.localId, t.anulada),
    index("facturas_cliente_idx").on(t.clienteId),
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
  contenidoMl: integer("contenido_ml"),
  concentracion: concentracionEnum("concentracion"),
  categoria: categoriaProductoEnum("categoria"),
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
    /** Se marca al anular la factura: la cuota se conserva, pero ya no se cobra. */
    anulada: boolean("anulada").notNull().default(false),
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
    /** Se marca al anular la factura: el abono se conserva, pero ya no cuenta como recaudo. */
    anulado: boolean("anulado").notNull().default(false),
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
    /** Copia de categoría.personal: un gasto personal no se resta de la utilidad. */
    personal: boolean("personal").notNull().default(false),
    descripcion: text("descripcion"),
    valor: integer("valor").notNull(),
    medioPago: medioPagoGastoEnum("medio_pago").notNull(),
    /** Día del gasto (sin hora), en formato AAAA-MM-DD. */
    fecha: date("fecha", { mode: "string" }).notNull(),
    creadoEn: creadoEn(),
    /*
     * Anulación ("Eliminar gasto"): el gasto NO se borra, solo se marca.
     * Un gasto anulado no cuenta en totales, estadísticas, utilidad ni Excel.
     */
    anulado: boolean("anulado").notNull().default(false),
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
    anuladoPorId: uuid("anulado_por_id").references(() => usuarios.id, { onDelete: "set null" }),
    anuladoPorNombre: text("anulado_por_nombre"),
    motivoAnulacion: text("motivo_anulacion"),
  },
  (t) => [index("gastos_local_fecha_idx").on(t.localId, t.fecha), index("gastos_local_anulado_idx").on(t.localId, t.anulado)],
);

/**
 * Trazabilidad del inventario: cada cambio de stock deja un movimiento.
 * "cantidad" lleva signo (+5 entra, -2 sale) y "stockResultante" es lo que quedó.
 * El nombre del usuario se copia (snapshot) para que el historial no cambie.
 */
export const movimientosInventario = pgTable(
  "movimientos_inventario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localId: uuid("local_id")
      .notNull()
      .references(() => locales.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id, { onDelete: "cascade" }),
    tipo: tipoMovimientoEnum("tipo").notNull(),
    cantidad: integer("cantidad").notNull(),
    stockResultante: integer("stock_resultante").notNull(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    usuarioNombre: text("usuario_nombre").notNull(),
    facturaId: uuid("factura_id").references(() => facturas.id, { onDelete: "set null" }),
    nota: text("nota"),
    creadoEn: creadoEn(),
  },
  (t) => [
    index("movimientos_producto_fecha_idx").on(t.productoId, t.creadoEn),
    index("movimientos_local_fecha_idx").on(t.localId, t.creadoEn),
  ],
);

/**
 * Proveedores de mercancía de cada local. Un proveedor con compras registradas no se borra: solo se desactiva.
 * "productosSurte" es texto libre (por ejemplo: «Perfumes árabes, réplicas 1.1»).
 */
export const proveedores = pgTable(
  "proveedores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localId: uuid("local_id")
      .notNull()
      .references(() => locales.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    contacto: text("contacto"),
    telefono: text("telefono"),
    productosSurte: text("productos_surte"),
    activo: boolean("activo").notNull().default(true),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [uniqueIndex("proveedores_local_nombre_uq").on(t.localId, sql`lower(${t.nombre})`)],
);

/**
 * Compra de mercancía a un proveedor (se registra al «Agregar unidades» de un perfume).
 * De contado: saldo 0 y estado SALDADA. A crédito: el saldo es lo que se le debe al proveedor
 * y baja con cada abono; al llegar a 0 pasa a SALDADA.
 * Copia (snapshot) los nombres del proveedor, del producto y del usuario.
 */
export const comprasMercancia = pgTable(
  "compras_mercancia",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localId: uuid("local_id")
      .notNull()
      .references(() => locales.id, { onDelete: "cascade" }),
    proveedorId: uuid("proveedor_id")
      .notNull()
      .references(() => proveedores.id, { onDelete: "restrict" }),
    proveedorNombre: text("proveedor_nombre").notNull(),
    productoId: uuid("producto_id").references(() => productos.id, { onDelete: "set null" }),
    productoNombre: text("producto_nombre").notNull(),
    cantidad: integer("cantidad").notNull(),
    total: integer("total").notNull(),
    medioPago: medioPagoCompraEnum("medio_pago").notNull(),
    saldo: integer("saldo").notNull().default(0),
    estado: estadoCuentaPagarEnum("estado").notNull(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    usuarioNombre: text("usuario_nombre").notNull(),
    nota: text("nota"),
    creadoEn: creadoEn(),
    saldadaEn: timestamp("saldada_en", { withTimezone: true }),
  },
  (t) => [
    index("compras_local_proveedor_idx").on(t.localId, t.proveedorId),
    index("compras_local_estado_idx").on(t.localId, t.estado),
  ],
);

/** Abonos a una compra a crédito (pago al proveedor). El nombre del usuario se copia (snapshot). */
export const abonosProveedor = pgTable(
  "abonos_proveedor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    compraId: uuid("compra_id")
      .notNull()
      .references(() => comprasMercancia.id, { onDelete: "cascade" }),
    valor: integer("valor").notNull(),
    medioPago: medioPagoEnum("medio_pago").notNull(),
    valorEfectivo: integer("valor_efectivo").notNull().default(0),
    valorTransferencia: integer("valor_transferencia").notNull().default(0),
    /** Día en que se le pagó al proveedor (AAAA-MM-DD). */
    fecha: date("fecha", { mode: "string" }).notNull(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    usuarioNombre: text("usuario_nombre").notNull(),
    nota: text("nota"),
    creadoEn: creadoEn(),
  },
  (t) => [index("abonos_proveedor_compra_idx").on(t.compraId)],
);

/**
 * Registro de auditoría de la "Limpieza del sistema": quién borró qué, cuándo y cuánto.
 * Se escribe en la MISMA transacción que el borrado (o se guardan los dos, o ninguno).
 * La app NO tiene forma de borrar este historial. Si luego se elimina el local o el administrador,
 * el registro se conserva con sus nombres copiados (snapshot).
 */
export const limpiezas = pgTable(
  "limpiezas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localId: uuid("local_id").references(() => locales.id, { onDelete: "set null" }),
    localNombre: text("local_nombre").notNull(),
    adminId: uuid("admin_id").references(() => usuarios.id, { onDelete: "set null" }),
    adminNombre: text("admin_nombre").notNull(),
    alcance: alcanceLimpiezaEnum("alcance").notNull(),
    /** Solo en la limpieza por periodo. */
    anio: integer("anio"),
    /** Meses del periodo (vacío = todo el año). */
    meses: integer("meses").array(),
    /** Cantidades y valores borrados (y lo que se conservó). */
    conteos: jsonb("conteos").$type<ConteosLimpieza>().notNull(),
    /** Suma del valor de las ventas, créditos y gastos borrados (pesos). */
    valorTotal: bigint("valor_total", { mode: "number" }).notNull().default(0),
    reinicioConsecutivo: boolean("reinicio_consecutivo").notNull().default(false),
    creadoEn: creadoEn(),
  },
  (t) => [index("limpiezas_local_fecha_idx").on(t.localId, t.creadoEn)],
);

/**
 * Límite de intentos (protección contra ataques de fuerza bruta y registros masivos).
 * Cada fila es un contador: "login:id:<identificación>", "login:ip:<ip>", "registro:ip:<ip>"...
 * Se guarda en la base de datos (y no en memoria) para que funcione con varios servidores.
 */
export const limiteIntentos = pgTable("limite_intentos", {
  clave: text("clave").primaryKey(),
  intentos: integer("intentos").notNull().default(0),
  /** Inicio de la ventana de tiempo en la que se cuentan los intentos. */
  desde: timestamp("desde", { withTimezone: true }).notNull().defaultNow(),
  /** Mientras esta fecha no pase, la acción está bloqueada para esa clave. */
  bloqueadoHasta: timestamp("bloqueado_hasta", { withTimezone: true }),
});

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

export const productosRelations = relations(productos, ({ one, many }) => ({
  local: one(locales, { fields: [productos.localId], references: [locales.id] }),
  marca: one(marcas, { fields: [productos.marcaId], references: [marcas.id] }),
  movimientos: many(movimientosInventario),
}));

export const movimientosInventarioRelations = relations(movimientosInventario, ({ one }) => ({
  producto: one(productos, { fields: [movimientosInventario.productoId], references: [productos.id] }),
  factura: one(facturas, { fields: [movimientosInventario.facturaId], references: [facturas.id] }),
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
export type MovimientoInventarioFila = typeof movimientosInventario.$inferSelect;
export type ProveedorFila = typeof proveedores.$inferSelect;
export type CompraMercancia = typeof comprasMercancia.$inferSelect;
export type AbonoProveedor = typeof abonosProveedor.$inferSelect;
