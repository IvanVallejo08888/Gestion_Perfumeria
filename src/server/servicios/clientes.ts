/**
 * Servicio de clientes. Cada local tiene su propia lista de clientes: TODAS las funciones
 * reciben el localId del vendedor y nunca devuelven datos de otro local.
 *
 *  - Autocompletar la factura al escribir la cédula (la única forma de buscarlo al facturar).
 *  - Lista paginada con buscador tolerante (tildes, espacios, orden, números con signos
 *    y, si la base tiene pg_trgm, errores de escritura pequeños).
 *  - Récord del cliente: resumen y todas sus facturas (por clienteId, no por la cédula
 *    guardada en la factura, para que funcione aunque se corrija la cédula).
 *  - Editar sus datos (las facturas antiguas NO cambian: son el registro de la venta).
 */
import "server-only";
import { and, asc, count, desc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clientes, facturaItems, facturas, sectores } from "@/db/schema";
import { ApiError } from "@/lib/api";
import { normalizarIdentificacion, puedeBuscarIdentificacion, resultadoBusqueda, type RespuestaBusquedaCliente } from "@/lib/busqueda-cliente";
import { camposBusquedaCliente, escaparLike, normalizarTelefono, normalizarTexto, soloDigitos } from "@/lib/formato";
import type {
  ClienteDatos,
  ClienteDetalle,
  ClienteFila,
  ListaClientes,
  ListaFacturasCliente,
  ResumenCliente,
} from "@/tipos";
import { COLUMNAS_RESUMEN, serializarResumen } from "./facturas";

/** Columnas que se devuelven para llenar la factura. */
const COLUMNAS_CLIENTE = {
  identificacion: clientes.identificacion,
  nombre: clientes.nombre,
  telefono: clientes.telefono,
  direccion: clientes.direccion,
  sector: clientes.sector,
};

const POR_PAGINA = 10;

/* ----------------------------- Autocompletado ----------------------------- */

/**
 * Cliente para autocompletar la factura, buscado SOLO por cédula y directamente en la tabla
 * clientes: no depende de facturas, compras ni anulaciones (un cliente con 0 compras o con
 * todas sus ventas anuladas también se encuentra). La cédula se compara solo con dígitos.
 *
 * Si no está en el local del vendedor pero sí en otro, se devuelven sus datos marcados con
 * otroLocal = true (sin id ni historial): al facturar se crea como cliente nuevo de ESTE local.
 */
export async function buscarClientePorIdentificacion(localId: string, identificacion: string): Promise<RespuestaBusquedaCliente> {
  const ident = normalizarIdentificacion(identificacion);
  if (!puedeBuscarIdentificacion(ident)) return resultadoBusqueda(null, null);

  const [delLocal] = await db
    .select(COLUMNAS_CLIENTE)
    .from(clientes)
    .where(and(eq(clientes.localId, localId), eq(clientes.identificacion, ident)))
    .limit(1);
  if (delLocal) return resultadoBusqueda(delLocal, null);

  // En otro local: los datos más recientes
  const [deOtroLocal] = await db
    .select(COLUMNAS_CLIENTE)
    .from(clientes)
    .where(and(ne(clientes.localId, localId), eq(clientes.identificacion, ident)))
    .orderBy(desc(clientes.actualizadoEn))
    .limit(1);
  return resultadoBusqueda(null, deOtroLocal);
}

/* ------------------------------ Lista y buscador ------------------------------ */

/** Totales por cliente (sin ventas anuladas), calculados en SQL. */
function totalesPorCliente(localId: string) {
  return db
    .select({
      clienteId: facturas.clienteId,
      compras: sql<number>`count(*)::int`.as("compras"),
      totalComprado: sql<number>`coalesce(sum(${facturas.total}), 0)::int`.as("total_comprado"),
      saldoPendiente: sql<number>`coalesce(sum(${facturas.saldo}), 0)::int`.as("saldo_pendiente"),
      ultimaCompra: sql<Date>`max(${facturas.creadoEn})`.as("ultima_compra"),
    })
    .from(facturas)
    .where(and(eq(facturas.localId, localId), eq(facturas.anulada, false)))
    .groupBy(facturas.clienteId)
    .as("totales");
}

/** Lo que escribió la persona, preparado para comparar con las columnas de búsqueda. */
function prepararBusqueda(q: string) {
  const texto = normalizarTexto(q);
  return {
    texto,
    palabras: texto.split(" ").filter(Boolean),
    compacto: texto.replace(/ /g, ""),
    digitos: soloDigitos(q),
    telefono: normalizarTelefono(q),
    tieneLetras: /\p{L}/u.test(q),
  };
}

/** Indica si la base tiene pg_trgm. Se averigua una vez; si falla, se desactiva la similitud. */
let trigramDisponible: boolean | null = null;

/**
 * Lista paginada de clientes del local (10 por página). Solo del local del vendedor.
 * Sin búsqueda: ordenados por última compra (los más recientes primero).
 * Con búsqueda, el orden es:
 *   1. cédula o teléfono EXACTOS (comparando solo dígitos);
 *   2. el nombre empieza por lo escrito;
 *   3. el nombre contiene lo escrito (palabras en cualquier orden, con o sin espacios);
 *   4. por similitud (pg_trgm), solo si lo anterior no encontró nada.
 */
export async function listarClientes(localId: string, q: string | undefined, paginaPedida: number): Promise<ListaClientes> {
  const b = prepararBusqueda(q ?? "");
  const totales = totalesPorCliente(localId);
  const delLocal = eq(clientes.localId, localId);

  /* Coincidencia exacta de cédula o teléfono */
  const exacta: SQL | undefined =
    b.digitos.length >= 5
      ? or(eq(clientes.identificacion, b.digitos), eq(clientes.telefonoDigitos, b.telefono))
      : undefined;

  /* Condiciones normales: números contenidos o palabras del nombre */
  const opciones: SQL[] = [];
  if (b.digitos.length >= 3) {
    opciones.push(ilike(clientes.identificacion, `%${escaparLike(b.digitos)}%`));
    opciones.push(ilike(clientes.telefonoDigitos, `%${escaparLike(b.telefono)}%`));
  }
  if (b.palabras.length) {
    // Cada palabra en cualquier parte del nombre: "ruiz carlos" y "car rui" encuentran a "Carlos Ruiz"
    opciones.push(and(...b.palabras.map((p) => ilike(clientes.nombreBusqueda, `%${escaparLike(p)}%`)))!);
    // Todo junto: "carlosruiz" encuentra a "Carlos Ruiz"
    opciones.push(ilike(clientes.nombreCompacto, `%${escaparLike(b.compacto)}%`));
  }
  const hayBusqueda = b.digitos.length > 0 || b.palabras.length > 0;
  const filtro = hayBusqueda ? and(delLocal, or(...opciones, ...(exacta ? [exacta] : []))) : delLocal;

  const empiezaPor = b.compacto
    ? or(ilike(clientes.nombreBusqueda, `${escaparLike(b.texto)}%`), ilike(clientes.nombreCompacto, `${escaparLike(b.compacto)}%`))
    : sql`false`;
  const rango = sql`case when ${exacta ?? sql`false`} then 0 when ${empiezaPor} then 1 else 2 end`;

  const [{ total }] = await db.select({ total: count() }).from(clientes).where(filtro);

  /* Respaldo: similitud (errores de escritura) cuando la búsqueda normal no encontró nada */
  if (total === 0 && b.tieneLetras && b.texto.length >= 3 && trigramDisponible !== false) {
    const similar = or(sql`${clientes.nombreBusqueda} % ${b.texto}`, sql`${b.texto} <% ${clientes.nombreBusqueda}`);
    try {
      return await db.transaction(async (tx) => {
        // Umbrales solo para esta transacción: 0.3 nombre completo, 0.5 palabra parecida
        await tx.execute(
          sql`select set_config('pg_trgm.similarity_threshold', '0.3', true), set_config('pg_trgm.word_similarity_threshold', '0.5', true)`,
        );
        const [{ n }] = await tx.select({ n: count() }).from(clientes).where(and(delLocal, similar));
        trigramDisponible = true;
        return paginar(tx as unknown as typeof db, {
          totales,
          condicion: and(delLocal, similar),
          total: n,
          paginaPedida,
          orden: [desc(sql`greatest(similarity(${clientes.nombreBusqueda}, ${b.texto}), word_similarity(${b.texto}, ${clientes.nombreBusqueda}))`)],
          exacta: null,
        });
      });
    } catch (error) {
      // Sin la extensión pg_trgm (o sin permisos): se sigue sin la búsqueda por similitud
      trigramDisponible = false;
      console.warn("[clientes] Búsqueda por similitud desactivada (¿falta pg_trgm?):", (error as Error).message);
    }
  }

  /* ¿Hay UN solo cliente con esa cédula o teléfono exactos? (para abrir su detalle solo) */
  let idExacto: string | null = null;
  if (exacta) {
    const encontrados = await db.select({ id: clientes.id }).from(clientes).where(and(delLocal, exacta)).limit(2);
    if (encontrados.length === 1) idExacto = encontrados[0].id;
  }

  return paginar(db, { totales, condicion: filtro, total, paginaPedida, orden: hayBusqueda ? [asc(rango)] : [], exacta: idExacto });
}

/** Trae una página de clientes con sus totales. */
async function paginar(
  conexion: typeof db,
  opciones: {
    totales: ReturnType<typeof totalesPorCliente>;
    condicion: SQL | undefined;
    total: number;
    paginaPedida: number;
    orden: SQL[];
    exacta: string | null;
  },
): Promise<ListaClientes> {
  const { totales, condicion, total, orden } = opciones;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  // Si piden una página que ya no existe (por ejemplo ?pagina=99), se muestra la última
  const pagina = Math.min(Math.max(1, opciones.paginaPedida), totalPaginas);

  const filas =
    total === 0
      ? []
      : await conexion
          .select({
            id: clientes.id,
            identificacion: clientes.identificacion,
            nombre: clientes.nombre,
            telefono: clientes.telefono,
            sector: clientes.sector,
            compras: sql<number>`coalesce(${totales.compras}, 0)`.mapWith(Number),
            totalComprado: sql<number>`coalesce(${totales.totalComprado}, 0)`.mapWith(Number),
            saldoPendiente: sql<number>`coalesce(${totales.saldoPendiente}, 0)`.mapWith(Number),
            ultimaCompra: sql<Date | null>`${totales.ultimaCompra}`.mapWith(facturas.creadoEn),
          })
          .from(clientes)
          .leftJoin(totales, eq(totales.clienteId, clientes.id))
          .where(condicion)
          .orderBy(...orden, sql`${totales.ultimaCompra} desc nulls last`, desc(clientes.creadoEn), asc(clientes.nombre))
          .limit(POR_PAGINA)
          .offset((pagina - 1) * POR_PAGINA);

  const lista: ClienteFila[] = filas.map((f) => ({ ...f, ultimaCompra: f.ultimaCompra ? new Date(f.ultimaCompra).toISOString() : null }));
  return { clientes: lista, total, pagina, totalPaginas, coincidenciaExacta: opciones.exacta };
}

/* ------------------------------- Detalle ------------------------------- */

export async function obtenerCliente(localId: string, id: string): Promise<ClienteDetalle> {
  const cliente = await db.query.clientes.findFirst({ where: and(eq(clientes.id, id), eq(clientes.localId, localId)) });
  // Un cliente de otro local responde igual que uno inexistente
  if (!cliente) throw new ApiError(404, "El cliente no existe.");
  return {
    id: cliente.id,
    identificacion: cliente.identificacion,
    nombre: cliente.nombre,
    telefono: cliente.telefono,
    direccion: cliente.direccion,
    sector: cliente.sector,
    creadoEn: cliente.creadoEn.toISOString(),
  };
}

/** Resumen del récord. Las ventas anuladas se cuentan aparte y no suman en los totales. */
export async function resumenCliente(localId: string, clienteId: string): Promise<ResumenCliente> {
  const vigente = sql`not ${facturas.anulada}`;
  const deCliente = and(eq(facturas.localId, localId), eq(facturas.clienteId, clienteId));

  const [[r], [favorito]] = await Promise.all([
    db
      .select({
        comprasContado: sql<number>`(count(*) filter (where ${vigente} and ${facturas.tipo} = 'NORMAL'))::int`,
        comprasCredito: sql<number>`(count(*) filter (where ${vigente} and ${facturas.tipo} = 'CREDITO'))::int`,
        totalComprado: sql<number>`coalesce(sum(${facturas.total}) filter (where ${vigente}), 0)::int`,
        saldoPendiente: sql<number>`coalesce(sum(${facturas.saldo}) filter (where ${vigente}), 0)::int`,
        creditosPendientes: sql<number>`(count(*) filter (where ${vigente} and ${facturas.tipo} = 'CREDITO' and ${facturas.estado} = 'PENDIENTE'))::int`,
        primeraCompra: sql<Date | null>`min(${facturas.creadoEn}) filter (where ${vigente})`.mapWith(facturas.creadoEn),
        ultimaCompra: sql<Date | null>`max(${facturas.creadoEn}) filter (where ${vigente})`.mapWith(facturas.creadoEn),
        anuladas: sql<number>`(count(*) filter (where ${facturas.anulada}))::int`,
        totalAnuladas: sql<number>`coalesce(sum(${facturas.total}) filter (where ${facturas.anulada}), 0)::int`,
      })
      .from(facturas)
      .where(deCliente),
    db
      .select({ nombre: facturaItems.nombreProducto, cantidad: sql<number>`sum(${facturaItems.cantidad})::int` })
      .from(facturaItems)
      .innerJoin(facturas, eq(facturaItems.facturaId, facturas.id))
      .where(and(deCliente, eq(facturas.anulada, false)))
      .groupBy(facturaItems.nombreProducto)
      .orderBy(desc(sql`sum(${facturaItems.cantidad})`), asc(facturaItems.nombreProducto))
      .limit(1),
  ]);

  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
  return {
    comprasContado: r.comprasContado,
    comprasCredito: r.comprasCredito,
    totalComprado: r.totalComprado,
    totalPagado: r.totalComprado - r.saldoPendiente,
    saldoPendiente: r.saldoPendiente,
    creditosPendientes: r.creditosPendientes,
    primeraCompra: iso(r.primeraCompra),
    ultimaCompra: iso(r.ultimaCompra),
    productoFavorito: favorito ?? null,
    anuladas: { cantidad: r.anuladas, total: r.totalAnuladas },
  };
}

/** Todas las facturas del cliente (también las anuladas), de la más reciente a la más antigua, de 10 en 10. */
export async function facturasDelCliente(
  localId: string,
  clienteId: string,
  filtros: { pagina: number; estado?: "COMPLETADA" | "PENDIENTE" | "ANULADA" },
): Promise<ListaFacturasCliente> {
  const condiciones: SQL[] = [eq(facturas.localId, localId), eq(facturas.clienteId, clienteId)];
  if (filtros.estado === "ANULADA") condiciones.push(eq(facturas.anulada, true));
  else if (filtros.estado) condiciones.push(eq(facturas.anulada, false), eq(facturas.estado, filtros.estado));

  const [{ total }] = await db.select({ total: count() }).from(facturas).where(and(...condiciones));
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(Math.max(1, filtros.pagina), totalPaginas);

  const filas = await db
    .select(COLUMNAS_RESUMEN)
    .from(facturas)
    .where(and(...condiciones))
    .orderBy(desc(facturas.creadoEn))
    .limit(POR_PAGINA)
    .offset((pagina - 1) * POR_PAGINA);

  return { facturas: filas.map(serializarResumen), total, pagina, totalPaginas };
}

/* -------------------------------- Edición -------------------------------- */

/**
 * Edita los datos del cliente. NO cambia las facturas antiguas: guardan una copia
 * de los datos del día de la venta (es el registro histórico).
 */
export async function editarCliente(localId: string, id: string, entrada: ClienteDatos): Promise<ClienteDetalle> {
  // La cédula se guarda solo con dígitos (igual que al facturar)
  const datos = { ...entrada, identificacion: normalizarIdentificacion(entrada.identificacion) };
  const actual = await obtenerCliente(localId, id);

  // La cédula no puede repetirse dentro del mismo local
  const repetido = await db.query.clientes.findFirst({
    where: and(eq(clientes.localId, localId), eq(clientes.identificacion, datos.identificacion), ne(clientes.id, id)),
    columns: { nombre: true },
  });
  if (repetido) {
    throw new ApiError(409, `Ya existe otro cliente con la cédula ${datos.identificacion} en este local: ${repetido.nombre}.`);
  }

  // El sector debe ser uno activo del local (o el que ya tenía, aunque luego se haya desactivado)
  if (datos.sector !== actual.sector) {
    const sector = await db.query.sectores.findFirst({
      where: and(eq(sectores.localId, localId), eq(sectores.nombre, datos.sector), eq(sectores.activo, true)),
    });
    if (!sector) throw new ApiError(400, "El sector elegido no existe o está desactivado en este local.");
  }

  await db
    .update(clientes)
    .set({ ...datos, ...camposBusquedaCliente(datos.nombre, datos.telefono), actualizadoEn: new Date() })
    .where(and(eq(clientes.id, id), eq(clientes.localId, localId)));

  return obtenerCliente(localId, id);
}
