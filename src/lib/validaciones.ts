/**
 * Validaciones compartidas entre el navegador y el servidor (Zod).
 * Todos los mensajes están en español y redactados de forma clara para el usuario.
 */
import { z } from "zod";

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

const texto = (campo: string, max = 120) =>
  z
    .string({ error: `${campo} es obligatorio.` })
    .trim()
    .min(1, `${campo} es obligatorio.`)
    .max(max, `${campo} es demasiado largo.`);

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
});

export const ajusteStockSchema = z.object({
  cantidad: z.coerce
    .number()
    .int("La cantidad debe ser un número entero.")
    .refine((v) => v !== 0, "La cantidad no puede ser cero."),
});

/* ---------------------------------- Clientes -------------------------------- */

export const clienteSchema = z.object({
  identificacion: identificacionSchema,
  nombre: texto("El nombre del cliente"),
  telefono: telefonoSchema,
  direccion: texto("La dirección", 160),
  sector: texto("El sector o barrio", 80),
});

/* --------------------------------- Facturas -------------------------------- */

export const itemFacturaSchema = z.object({
  productoId: z.uuid("Producto no válido."),
  cantidad: z.coerce.number().int().min(1, "La cantidad mínima es 1."),
});

export const cuotaSchema = z.object({
  fechaVencimiento: z.iso.datetime({ offset: true, error: "Fecha de cuota no válida." }),
});

export const crearFacturaSchema = z
  .object({
    tipo: z.enum(["NORMAL", "CREDITO"]),
    cliente: clienteSchema,
    items: z.array(itemFacturaSchema).min(1, "Agrega al menos un producto a la factura."),
    adicional: dineroSchema("El pago adicional").default(0),
    descuento: dineroSchema("El descuento").default(0),
    notas: z.string().trim().max(300).optional(),
    cuotas: z.array(cuotaSchema).max(60, "Máximo 60 cuotas.").optional(),
  })
  .refine((d) => d.tipo === "NORMAL" || (d.cuotas && d.cuotas.length >= 1), {
    message: "Un crédito debe tener al menos una cuota.",
    path: ["cuotas"],
  });

export const abonoSchema = z.object({
  valor: dineroSchema("El valor del abono").refine((v) => v > 0, "El abono debe ser mayor que cero."),
  nota: z.string().trim().max(200).optional(),
});

/** Devuelve el primer mensaje de error de Zod (para mostrarlo al usuario). */
export function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Los datos enviados no son válidos.";
}
