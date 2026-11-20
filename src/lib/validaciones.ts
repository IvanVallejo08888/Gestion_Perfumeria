/**
 * Validaciones compartidas entre el navegador y el servidor (Zod).
 * Todos los mensajes están en español y redactados de forma clara para el usuario.
 */
import { z } from "zod";
import { soloDigitos } from "./formato";

/*
 * Mensajes por defecto de Zod en español (por ejemplo «Opción inválida…» en vez de «Invalid option…»).
 * Aplica a todos los esquemas: los que traen su propio mensaje lo conservan. Este archivo lo cargan
 * el servidor (vía src/lib/api.ts) y los formularios del navegador, así que se configura en ambos.
 */
z.config(z.locales.es());
import { CATEGORIAS, CONCENTRACIONES, GENEROS, PUBLICOS, TIPOS_PRODUCTO } from "./clasificacion";
import { validarPlanCuotas } from "./deudas";
import { ESTADOS_STOCK } from "./inventario";
import { ALCANCES_LIMPIEZA } from "./limpieza";

/* --------------------------- Reglas de contraseña --------------------------- */

/**
 * Cada regla se muestra en pantalla como una lista de verificación,
 * así la persona sabe exactamente qué le falta a su contraseña.
 */
export const REGLAS_PASSWORD = [
  { id: "longitud", texto: "Mínimo 8 caracteres", prueba: (v: string) => v.length >= 8 },
  { id: "mayuscula", texto: "Una letra MAYÚSCULA", prueba: (v: string) => /[A-ZÁÉÍÓÚÑ]/.test(v) },
  { id: "minuscula", texto: "Una letra minúscula", prueba: (v: string) => /[a-záéíóúñ]/.test(v) },
  { id: "numero", texto: "Un número (0-9)", prueba: (v: string) => /\d/.test(v) },
  { id: "especial", texto: "Un símbolo (por ejemplo $ # @ ! *)", prueba: (v: string) => /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s]/.test(v) },
] as const;

export function passwordEsValida(valor: string): boolean {
  return REGLAS_PASSWORD.every((regla) => regla.prueba(valor));
}

export const passwordSchema = z
  .string()
  .max(72, "La contraseña es demasiado larga (máximo 72 caracteres).")
  .refine(passwordEsValida, "La contraseña no cumple todos los requisitos de seguridad.");

/* ------------------------------ Campos comunes ------------------------------ */

/** `genero` concuerda el mensaje con el campo: "El nombre … obligatorio" / "La dirección … obligatoria". */
const texto = (campo: string, max = 120, genero: "m" | "f" = "m") => {
  const o = genero === "f" ? "a" : "o";
  return z
    .string({ error: `${campo} es obligatori${o}.` })
    .trim()
    .min(1, `${campo} es obligatori${o}.`)
    .max(max, `${campo} es demasiado larg${o}.`);
};

export const identificacionSchema = z
  .string({ error: "La identificación es obligatoria." })
  .trim()
  .regex(/^[0-9]{5,15}$/, "La identificación debe tener solo números (entre 5 y 15 dígitos).");

export const telefonoSchema = z
  .string({ error: "El teléfono es obligatorio." })
  .trim()
  .regex(/^[0-9+\s-]{7,15}$/, "Escribe un número de teléfono válido (7 a 15 dígitos).");

export const correoSchema = z
  .string({ error: "El correo es obligatorio." })
  .trim()
  .toLowerCase()
  .pipe(z.email("Escribe un correo electrónico válido, por ejemplo: nombre@correo.com"));

/** Valor de dinero en pesos (entero, sin decimales, no negativo). */
export const dineroSchema = (campo: string) =>
  z.coerce
    .number({ error: `${campo} debe ser un número.` })
    .int(`${campo} debe ser un valor sin decimales.`)
    .min(0, `${campo} no puede ser negativo.`)
    .max(1_000_000_000, `${campo} es demasiado alto.`);

/* ------------------------------- Autenticación ------------------------------ */

export const loginSchema = z.object({
  // Con límite de largo: la identificación forma parte de la clave del límite de intentos
  identificacion: z.string().trim().min(1, "Escribe tu número de identificación.").max(20, "La identificación es demasiado larga."),
  password: z.string().min(1, "Escribe tu contraseña.").max(200, "La contraseña es demasiado larga."),
});

export const registroSchema = z
  .object({
    nombre: texto("El nombre"),
    identificacion: identificacionSchema,
    correo: correoSchema,
    telefono: telefonoSchema,
    password: passwordSchema,
    confirmarPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmarPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmarPassword"],
  });

/* --------------------------------- Locales --------------------------------- */

export const localSchema = z.object({
  nombre: texto("El nombre del local", 80),
  direccion: z.string().trim().max(160).optional().default(""),
  telefono: z.string().trim().max(20).optional().default(""),
  activo: z.boolean().optional().default(true),
});

/* --------------------------------- Usuarios -------------------------------- */

export const editarUsuarioSchema = z.object({
  nombre: texto("El nombre"),
  identificacion: identificacionSchema,
  correo: correoSchema,
  telefono: telefonoSchema,
});

export const asignarLocalSchema = z.object({
  localId: z.uuid("Selecciona un local válido."),
});

export const cambiarPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmarPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmarPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmarPassword"],
  });

export const cambiarEstadoSchema = z.object({
  estado: z.enum(["ACTIVO", "PAUSADO"], { error: "Estado no válido." }),
});

/* --------------------------------- Productos ------------------------------- */

/** Texto opcional: "" o solo espacios se guardan como vacío (null). */
const textoOpcional = (campo: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${campo} es demasiado largo.`)
    .optional()
    .nullable()
    .transform((v) => v || null);

/**
 * Producto del inventario. Obligatorios: marca, nombre de la fragancia y precio.
 * Las demás características son opcionales (un estuche o un accesorio no tienen ml ni concentración).
 * El nombre completo NO viene del navegador: lo arma el servidor con armarNombreProducto().
 */
export const productoSchema = z.object({
  /** Nombre de la marca (se elige de las del local o se escribe una nueva). */
  marca: texto("El nombre de la marca", 80),
  nombre: texto("El nombre de la fragancia", 120),
  variante: textoOpcional("La variante", 60),
  concentracion: z.enum(CONCENTRACIONES, { error: "Concentración no válida." }).nullable().optional().default(null),
  contenidoMl: z.coerce
    .number({ error: "El contenido debe ser un número de mililitros." })
    .int("El contenido debe ser un número entero de mililitros.")
    .min(1, "El contenido debe ser mayor que cero.")
    .max(5000, "El contenido es demasiado alto.")
    .nullable()
    .optional()
    .default(null),
  genero: z.enum(GENEROS, { error: "Género no válido." }).nullable().optional().default(null),
  publico: z.enum(PUBLICOS, { error: "Público no válido." }).nullable().optional().default(null),
  categoria: z.enum(CATEGORIAS, { error: "Categoría no válida." }).nullable().optional().default(null),
  tipo: z.enum(TIPOS_PRODUCTO, { error: "Tipo no válido." }).nullable().optional().default(null),
  codigo: z.string().trim().max(40).optional().default(""),
  precio: dineroSchema("El precio").refine((v) => v > 0, "El precio debe ser mayor que cero."),
  stock: z.coerce.number().int("El stock debe ser un número entero.").min(0, "El stock no puede ser negativo."),
  stockMinimo: z.coerce.number().int().min(0).default(0),
});

/** Consulta de posible duplicado (misma marca, nombre, variante, concentración y ml). */
export const duplicadoProductoSchema = productoSchema
  .pick({ marca: true, nombre: true, variante: true, concentracion: true, contenidoMl: true })
  .extend({ excluirId: z.uuid().optional() });

const notaMovimiento = z.string().trim().max(200, "La nota es demasiado larga (máximo 200 caracteres).");

/** Ajuste manual (corrección, daño, conteo): suma o resta y SIEMPRE lleva el motivo. */
export const ajusteStockSchema = z.object({
  cantidad: z.coerce
    .number()
    .int("La cantidad debe ser un número entero.")
    .refine((v) => v !== 0, "La cantidad no puede ser cero."),
  nota: notaMovimiento.min(3, "Escribe el motivo del ajuste."),
});

/** Llegó mercancía: solo suma unidades. La nota es opcional. */
/**
 * Compra al proveedor (opcional al agregar unidades): quién la surtió, cuánto costó y cómo se pagó.
 * Con «Crédito» queda una cuenta por pagar a ese proveedor.
 */
export const compraMercanciaSchema = z.object({
  proveedorId: z.uuid("Elige el proveedor."),
  total: dineroSchema("El valor de la compra").refine((v) => v > 0, "Escribe el valor total de la compra."),
  medioPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "CREDITO"], { error: "Elige cómo se pagó la compra." }),
});

export const ingresoStockSchema = z.object({
  cantidad: z.coerce
    .number({ error: "Escribe la cantidad de unidades." })
    .int("La cantidad debe ser un número entero.")
    .min(1, "Escribe una cantidad mayor que cero.")
    .max(100_000, "La cantidad es demasiado alta."),
  nota: notaMovimiento.optional().default(""),
  compra: compraMercanciaSchema.optional(),
});

/** Filtros del inventario (query params). Se valida en el servidor; el navegador ignora valores raros. */
export const filtroProductosSchema = z.object({
  q: z.string().trim().max(80).optional(),
  genero: z.enum(GENEROS).optional(),
  publico: z.enum(PUBLICOS).optional(),
  marcaId: z.uuid("Marca no válida.").optional(),
  tipo: z.enum(TIPOS_PRODUCTO).optional(),
  categoria: z.enum(CATEGORIAS).optional(),
  stock: z.enum(ESTADOS_STOCK).optional(),
});

/* ---------------------------------- Clientes -------------------------------- */

/**
 * Cédula del cliente: se guarda SOLO con dígitos ("1.080.044.910" → "1080044910"), igual en la
 * factura y en la pantalla Clientes, para que el índice único (local, identificación) no deje
 * pasar el mismo cliente dos veces por diferencias de formato.
 */
export const identificacionClienteSchema = z
  .string({ error: "La identificación es obligatoria." })
  .transform(soloDigitos)
  .pipe(z.string().regex(/^[0-9]{5,15}$/, "La identificación debe tener solo números (entre 5 y 15 dígitos)."));

export const clienteSchema = z.object({
  identificacion: identificacionClienteSchema,
  nombre: texto("El nombre del cliente"),
  telefono: telefonoSchema,
  direccion: texto("La dirección", 160, "f"),
  sector: texto("El sector", 80),
});

/* --------------------------------- Facturas -------------------------------- */

export const itemFacturaSchema = z.object({
  productoId: z.uuid("Producto no válido."),
  cantidad: z.coerce.number().int().min(1, "La cantidad mínima es 1."),
});

export const cuotaSchema = z.object({
  fechaVencimiento: z.iso.datetime({ offset: true, error: "Fecha de cuota no válida." }),
});

const medioPagoSchema = z.enum(["EFECTIVO", "TRANSFERENCIA", "MIXTO"], { error: "Elige el medio de pago." });

/**
 * Valores que envía el navegador en un pago mixto. El servidor los recalcula
 * y rechaza el pago si no cuadran con el total que él mismo obtiene.
 */
const valoresPago = {
  valorTransferencia: dineroSchema("El valor de la transferencia").optional(),
  valorEfectivo: dineroSchema("El valor en efectivo").optional(),
};

export const crearFacturaSchema = z
  .object({
    tipo: z.enum(["NORMAL", "CREDITO"]),
    cliente: clienteSchema,
    items: z.array(itemFacturaSchema).min(1, "Agrega al menos un producto a la factura."),
    adicional: dineroSchema("El pago adicional").default(0),
    descuento: dineroSchema("El descuento").default(0),
    notas: z.string().trim().max(300).optional(),
    cuotas: z.array(cuotaSchema).max(60, "Máximo 60 cuotas.").optional(),
    // Solo para ventas de contado: en el crédito el dinero entra con cada abono
    medioPago: medioPagoSchema.optional(),
    ...valoresPago,
  })
  .refine((d) => d.tipo === "CREDITO" || d.medioPago, {
    message: "Elige el medio de pago.",
    path: ["medioPago"],
  })
  .refine((d) => d.tipo === "NORMAL" || (d.cuotas && d.cuotas.length >= 1), {
    message: "Un crédito debe tener al menos una cuota.",
    path: ["cuotas"],
  });

export const abonoSchema = z.object({
  valor: dineroSchema("El valor del abono").refine((v) => v > 0, "El abono debe ser mayor que cero."),
  nota: z.string().trim().max(200).optional(),
  medioPago: medioPagoSchema,
  ...valoresPago,
});

/* -------------------------------- Proveedores ------------------------------- */

/** Texto opcional: vacío se guarda como «sin dato». */
const textoOpcionalProveedor = (campo: string, max: number) =>
  z.string().trim().max(max, `${campo} es demasiado largo (máximo ${max} caracteres).`).optional().default("");

export const proveedorSchema = z.object({
  nombre: texto("El nombre del proveedor", 80),
  contacto: textoOpcionalProveedor("El contacto", 80),
  telefono: z.union([z.literal(""), telefonoSchema]).optional().default(""),
  productosSurte: textoOpcionalProveedor("La lista de productos", 300),
  activo: z.boolean().optional().default(true),
});

/** Abono a una compra a crédito (pago al proveedor). */
export const abonoProveedorSchema = z.object({
  valor: dineroSchema("El valor del abono").refine((v) => v > 0, "El abono debe ser mayor que cero."),
  medioPago: medioPagoSchema,
  ...valoresPago,
  fecha: z.iso.date("Escribe una fecha válida."),
  nota: z.string().trim().max(200, "La nota es demasiado larga.").optional(),
});

/* --------------------------------- Sectores -------------------------------- */

const nombreSector = texto("El nombre del sector", 80);

/** Varios nombres a la vez (el administrador puede pegar una lista). */
export const agregarSectoresSchema = z.object({
  nombres: z.array(nombreSector).min(1, "Escribe al menos un sector.").max(300, "Máximo 300 sectores a la vez."),
});

export const editarSectorSchema = z.object({
  nombre: nombreSector.optional(),
  activo: z.boolean().optional(),
});

/* ---------------------------------- Marcas --------------------------------- */

const nombreMarca = texto("El nombre de la marca", 80);

export const agregarMarcasSchema = z.object({
  nombres: z.array(nombreMarca).min(1, "Escribe al menos una marca.").max(300, "Máximo 300 marcas a la vez."),
});

/** El vendedor agrega UNA marca desde el formulario de producto. */
export const nuevaMarcaSchema = z.object({
  nombre: nombreMarca,
});

export const editarMarcaSchema = z.object({
  nombre: nombreMarca.optional(),
  activo: z.boolean().optional(),
});

/* ---------------------------------- Gastos --------------------------------- */

const nombreCategoria = texto("El nombre de la categoría", 60);

export const agregarCategoriasSchema = z.object({
  nombres: z.array(nombreCategoria).min(1, "Escribe al menos una categoría.").max(100, "Máximo 100 categorías a la vez."),
});

export const editarCategoriaSchema = z.object({
  nombre: nombreCategoria.optional(),
  activo: z.boolean().optional(),
});

/** Una cuota del plan de pagos de una deuda: fecha y hora + valor (editable). */
export const cuotaDeudaSchema = z.object({
  fechaVencimiento: z.iso.datetime({ offset: true, error: "Fecha de cuota no válida." }),
  valor: dineroSchema("El valor de la cuota").refine((v) => v > 0, "Cada cuota debe ser mayor que cero."),
});

/**
 * Gasto. Con medio CREDITO (gasto a crédito) también exige el acreedor y el plan de cuotas,
 * y que las cuotas sumen exactamente el valor del gasto. Las fechas pasadas se permiten (deudas antiguas).
 */
export const gastoSchema = z
  .object({
    categoriaId: z.uuid("Elige una categoría."),
    valor: dineroSchema("El valor del gasto").refine((v) => v > 0, "El gasto debe ser mayor que cero."),
    medioPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "CREDITO"], { error: "Elige cómo se pagó el gasto." }),
    fecha: z.iso.date("Escribe una fecha válida."),
    descripcion: z.string().trim().max(200, "La descripción es demasiado larga.").optional(),
    /** Solo en CREDITO: a quién se le debe. */
    acreedor: z.string().trim().max(80, "El nombre es demasiado largo (máximo 80 caracteres).").optional(),
    /** Solo en CREDITO: plan de pagos. */
    cuotas: z.array(cuotaDeudaSchema).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.medioPago !== "CREDITO") return;
    if (!d.acreedor || d.acreedor.length < 2) {
      ctx.addIssue({ code: "custom", path: ["acreedor"], message: "Escribe a quién le debes (mínimo 2 letras)." });
    }
    const error = validarPlanCuotas(d.valor, (d.cuotas ?? []).map((c) => c.valor));
    if (error) ctx.addIssue({ code: "custom", path: ["cuotas"], message: error });
  });

/** Pago (abono) a una deuda. Sin fecha = ahora. Con fecha: un pago olvidado (nunca futuro). */
export const pagoDeudaSchema = z.object({
  valor: dineroSchema("El valor del pago").refine((v) => v > 0, "El pago debe ser mayor que cero."),
  medioPago: medioPagoSchema,
  ...valoresPago,
  fecha: z.iso.datetime({ offset: true, error: "Escribe una fecha válida." }).optional(),
  nota: z.string().trim().max(200, "La nota es demasiado larga.").optional(),
});

/** Filtro de la lista de deudas. */
export const filtroDeudasSchema = z.object({
  estado: z.enum(["PENDIENTE", "PAGADA", "ANULADA"]).default("PENDIENTE"),
});

/** Día de la caja (AAAA-MM-DD). */
export const cajaSchema = z.object({
  fecha: z.iso.date("Escribe una fecha válida."),
});

/** Filtros de la lista de gastos (vienen en la dirección de la petición). */
export const filtroGastosSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  categoriaId: z.uuid("Categoría no válida.").optional(),
  /** "eliminados" muestra solo los gastos anulados; si no se envía, solo los vigentes. */
  estado: z.enum(["eliminados"]).optional(),
});

/* -------------------------------- Anulaciones ------------------------------- */

/** Motivo para eliminar (anular) una venta o un gasto: obligatorio, de 5 a 200 caracteres. */
export const motivoAnulacionSchema = z.object({
  motivo: z
    .string({ error: "Escribe el motivo de la eliminación." })
    .trim()
    .min(5, "El motivo debe tener al menos 5 caracteres.")
    .max(200, "El motivo no puede tener más de 200 caracteres."),
});

/** Filtros de la lista de clientes. */
export const filtroClientesSchema = z.object({
  q: z.string().trim().max(100, "La búsqueda es demasiado larga.").optional(),
  pagina: z.coerce.number().int().min(1).max(100_000).optional().default(1),
});

/** Filtros del récord de facturas de un cliente. */
export const filtroFacturasClienteSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100_000).optional().default(1),
  estado: z.enum(["COMPLETADA", "PENDIENTE", "ANULADA"], { error: "Estado no válido." }).optional(),
});

/** Identificador recibido en la dirección de un endpoint. */
export const idSchema = z.uuid("El registro no existe.");

/** Dashboard de reportes: año, mes opcional y (solo administrador) local; sin local = consolidado. */
export const filtroDashboardSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  localId: z.uuid("Selecciona un local válido.").optional(),
});

/** Créditos: búsqueda libre del cliente por identificación, celular o nombre (también acepta ?identificacion=). */
export const filtroCreditosSchema = z.object({
  q: z.string().trim().max(100, "La búsqueda es demasiado larga.").optional(),
  identificacion: z.string().trim().max(30).optional(),
});

/** Convierte los parámetros de la dirección en objeto y descarta los vacíos. */
export function parametros(url: URLSearchParams): Record<string, string> {
  return Object.fromEntries([...url].filter(([, valor]) => valor !== ""));
}

/** Devuelve el primer mensaje de error de Zod (para mostrarlo al usuario). */
export function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Los datos enviados no son válidos.";
}

/* ------------------------ Quejas e inquietudes (soporte) ------------------------ */

export const TIPOS_QUEJA = [
  { valor: "ERROR", texto: "Error" },
  { valor: "SUGERENCIA", texto: "Sugerencia" },
  { valor: "DUDA", texto: "Duda" },
] as const;

/** Módulos de la aplicación (Usuarios y Locales son solo del administrador). */
export const MODULOS = [
  { id: "facturacion", nombre: "Facturación" },
  { id: "creditos", nombre: "Créditos y abonos" },
  { id: "gastos", nombre: "Gastos" },
  { id: "inventario", nombre: "Inventario" },
  { id: "notificaciones", nombre: "Notificaciones" },
  { id: "reportes", nombre: "Reportes" },
  { id: "usuarios", nombre: "Usuarios", soloAdmin: true },
  { id: "locales", nombre: "Locales", soloAdmin: true },
] as const;

/** Pantallas que se pueden elegir en «¿En qué pantalla pasó?»: los módulos + Ajustes + Otra. */
export const PANTALLAS_QUEJA = [...MODULOS, { id: "ajustes", nombre: "Ajustes" }, { id: "otra", nombre: "Otra / no estoy seguro" }] as const;

export const quejaSchema = z.object({
  tipo: z.enum(["ERROR", "SUGERENCIA", "DUDA"], { error: "Elige si es un error, una sugerencia o una duda." }),
  pantalla: z
    .string({ error: "Elige la pantalla donde pasó." })
    .refine((v) => PANTALLAS_QUEJA.some((p) => p.id === v), "Elige la pantalla donde pasó."),
  descripcion: z
    .string({ error: "Cuéntanos qué pasó." })
    .trim()
    .min(10, "Cuéntanos un poco más: escribe mínimo 10 caracteres.")
    .max(1000, "El texto es demasiado largo (máximo 1000 caracteres)."),
});

export type Queja = z.infer<typeof quejaSchema>;

/* ---------------------------- Limpieza del sistema ---------------------------- */

/** Qué limpiar (lo usan la vista previa, el respaldo y la ejecución). */
export const solicitudLimpiezaSchema = z.object({
  localId: z.uuid("Elige un local."),
  alcance: z.enum(ALCANCES_LIMPIEZA, { error: "Lo que se quiere borrar no es válido." }),
  anio: z.coerce.number().int().min(2000, "Año no válido.").max(2100, "Año no válido.").optional(),
  /** Meses 1-12 (vacío = todo el año). En la dirección del respaldo llegan como "3,4". */
  meses: z
    .union([z.array(z.coerce.number()), z.string()])
    .optional()
    .transform((v) => (typeof v === "string" ? v.split(",").filter(Boolean).map(Number) : (v ?? [])))
    .pipe(z.array(z.number().int().min(1, "Mes no válido.").max(12, "Mes no válido.")).max(12)),
});

/** Ejecutar la limpieza: además exige la confirmación escrita, la contraseña y la huella del respaldo. */
export const ejecutarLimpiezaSchema = solicitudLimpiezaSchema.extend({
  confirmacion: z.string().max(200, "La confirmación es demasiado larga."),
  password: z.string().min(1, "Escribe tu contraseña."),
  huella: z.string().min(1, "Primero se debe descargar la copia de respaldo.").max(10_000),
  reiniciarConsecutivo: z.boolean().optional().default(false),
});
