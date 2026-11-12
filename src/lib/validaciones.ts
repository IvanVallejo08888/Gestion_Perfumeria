/**
 * Validaciones compartidas entre el navegador y el servidor (Zod).
 * Todos los mensajes están en español y redactados de forma clara para el usuario.
 */
import { z } from "zod";

/*
 * Mensajes por defecto de Zod en español (por ejemplo «Opción inválida…» en vez de «Invalid option…»).
 * Aplica a todos los esquemas: los que traen su propio mensaje lo conservan. Este archivo lo cargan
 * el servidor (vía src/lib/api.ts) y los formularios del navegador, así que se configura en ambos.
 */
z.config(z.locales.es());
import { GENEROS, PUBLICOS, TAMANOS, TIPOS_PRODUCTO } from "./clasificacion";
import { ESTADOS_STOCK } from "./inventario";
import { MODULOS } from "./guia-usuario";

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
  identificacion: z.string().trim().min(1, "Escribe tu número de identificación."),
  password: z.string().min(1, "Escribe tu contraseña."),
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

export const productoSchema = z.object({
  nombre: texto("El nombre del producto", 120),
  codigo: z.string().trim().max(40).optional().default(""),
  precio: dineroSchema("El precio").refine((v) => v > 0, "El precio debe ser mayor que cero."),
  stock: z.coerce.number().int("El stock debe ser un número entero.").min(0, "El stock no puede ser negativo."),
  stockMinimo: z.coerce.number().int().min(0).default(3),
  marcaId: z.uuid("Elige la marca."),
  tipo: z.enum(TIPOS_PRODUCTO, { error: "Elige el tipo (Original, 1.1, Imitación, Versión o Esencia)." }),
  genero: z.enum(GENEROS, { error: "Elige si es para hombre o para mujer." }),
  publico: z.enum(PUBLICOS, { error: "Elige si es para adulto o infantil." }),
  tamano: z.enum(TAMANOS, { error: "Elige el tamaño." }),
});

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
export const ingresoStockSchema = z.object({
  cantidad: z.coerce
    .number({ error: "Escribe la cantidad de unidades." })
    .int("La cantidad debe ser un número entero.")
    .min(1, "Escribe una cantidad mayor que cero.")
    .max(100_000, "La cantidad es demasiado alta."),
  nota: notaMovimiento.optional().default(""),
});

/** Filtros del inventario (query params). Se valida en el servidor; el navegador ignora valores raros. */
export const filtroProductosSchema = z.object({
  q: z.string().trim().max(80).optional(),
  genero: z.enum(GENEROS).optional(),
  publico: z.enum(PUBLICOS).optional(),
  marcaId: z.uuid("Marca no válida.").optional(),
  tipo: z.enum(TIPOS_PRODUCTO).optional(),
  tamano: z.enum(TAMANOS).optional(),
  stock: z.enum(ESTADOS_STOCK).optional(),
});

/* ---------------------------------- Clientes -------------------------------- */

export const clienteSchema = z.object({
  identificacion: identificacionSchema,
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

export const gastoSchema = z.object({
  categoriaId: z.uuid("Elige una categoría."),
  valor: dineroSchema("El valor del gasto").refine((v) => v > 0, "El gasto debe ser mayor que cero."),
  medioPago: z.enum(["EFECTIVO", "TRANSFERENCIA"], { error: "Elige cómo se pagó el gasto." }),
  fecha: z.iso.date("Escribe una fecha válida."),
  descripcion: z.string().trim().max(200, "La descripción es demasiado larga.").optional(),
});

/** Filtros de la lista de gastos (vienen en la dirección de la petición). */
export const filtroGastosSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  categoriaId: z.uuid("Categoría no válida.").optional(),
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
