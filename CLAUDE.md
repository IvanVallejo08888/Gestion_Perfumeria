# CLAUDE.md — Gestión de Perfumerías

Sistema web para locales: facturación (contado/crédito), créditos y abonos, gastos, inventario,
notificaciones y reportes Excel. Usuarios: un ADMIN y vendedores (cada uno ligado a un local).

## Stack
Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL + Drizzle ORM · Zod 4 · Tailwind CSS 4 ·
Recharts 3 · ExcelJS · jsPDF · sesión con JWT (jose) validada contra la BD en cada petición.

## Comandos (package.json)
- `npm run dev` — servidor de desarrollo (http://localhost:3000)
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — `node --import tsx --test` sobre una lista FIJA de archivos `*.test.ts`
  (si creas un test nuevo, agrégalo al script `test` o no se ejecuta)
- `npm run db:generate` — crea la migración en `drizzle/` tras editar `src/db/schema.ts`
- `npm run db:migrate` — aplica migraciones pendientes
- `npm run db:seed` — crea el administrador si no existe

## Arquitectura (flujo para una función nueva)
tabla en `src/db/schema.ts` → `npm run db:generate` → lógica en `src/server/servicios/` →
endpoint en `src/app/api/` → pantalla en `src/app/panel/` (vendedor) o `src/app/admin/`.
Tipos compartidos API↔pantallas en `src/tipos/index.ts`.

## Convenciones que YA usa el proyecto
- **Dinero = entero en pesos COP**, sin decimales (`integer` en BD, `dineroSchema` en Zod,
  `pesos()` de `src/lib/formato.ts` para mostrar). Nunca usar float.
- **Snapshots:** facturas copian datos del cliente, sector, vendedor y productos
  (`clienteNombre`, `precioUnitario`…); gastos copian categoría y usuario. El historial no cambia
  si luego se edita el original. Mantener este patrón en tablas históricas nuevas.
- **Lógica de negocio solo en `src/server/servicios/*`** (`import "server-only"`). Operaciones de
  varios pasos van en `db.transaction`. Errores para el usuario: `throw new ApiError(status, "mensaje")`.
  El servidor recalcula totales y pagos: nunca confiar en valores del navegador.
- **Rutas API** (`src/lib/api.ts`): `export const GET = manejador("VENDEDOR" | "ADMIN" | "AUTENTICADO" | "PUBLICO", async ({ req, usuario, params }) => …)`;
  en rutas de vendedor `const { localId } = comoVendedor(usuario)`; cuerpo con `leerCuerpo(req, esquema)`;
  respuesta con `ok(datos, status)`. La ruta es delgada: valida y llama al servicio.
- **Validación Zod** en `src/lib/validaciones.ts`, compartida por servidor y navegador; mensajes en español.
  Query params con `esquema.parse(parametros(req.nextUrl.searchParams))`.
- **Cliente:** páginas `"use client"`; leer con `useConsulta` / `useConsultaPaginada` (`src/hooks`),
  escribir con `api()` de `src/lib/http.ts`; avisos con `useAvisos()`.
- **UI** desde `src/components/ui`: `Boton` (variantes primario/secundario/peligro/exito/fantasma),
  `Campo`, `CampoDinero`, `CampoPassword`, `Selector`, `Tarjeta`, `Insignia`, `Mensaje`,
  `EncabezadoPagina`, `Cargando`, `Vacio`, `Dato`, `Modal`, `Confirmar`, `Desplegable`, `Icono`.
  Compartidos en `src/components/compartidos` (TablaGastos, VistaEstadisticas, GestorNombres…).
- **Fechas** en hora de Colombia (`ZONA_HORARIA`, `hoyColombia`, `fecha`, `fechaHora` en `formato.ts`).
- **Textos en español** (UI, mensajes de error, comentarios, nombres de variables y funciones).
- **Accesibilidad:** letra base 18px (A/A+/A++), Atkinson Hyperlegible, alto contraste WCAG AA con
  colores del tema (`marca-*`, `exito-*`, `alerta-*`, `peligro-*`, `info-*`, `texto`, `borde`),
  etiquetas siempre visibles, el estado nunca depende solo del color (siempre con texto o ícono).

## Reglas de trabajo (obligatorias en todas las tareas)
1. **Rama:** trabajar SIEMPRE en la rama actual `gabriel-castro`. No crear ramas, no hacer push,
   no tocar `main`. Si la rama activa no es `gabriel-castro`, detenerse y avisar.
2. **Plan primero:** antes de codificar, mostrar un plan por archivo (qué se crea o cambia y por qué)
   y esperar el OK explícito.
3. **Esquema:** cambios de BD solo editando `src/db/schema.ts` + migración generada con
   `npm run db:generate`. Nunca escribir SQL de migración a mano ni usar `db:push`.
4. **No duplicar:** buscar primero en `src/server/servicios`, `src/lib`, `src/hooks` y
   `src/components`; reutilizar o extender lo existente.
5. **Responsivo obligatorio:** probar a 360px (celular), 768px (tablet) y 1280px (escritorio),
   sin scroll horizontal. Botones y controles táctiles de mínimo 48px de alto.
6. **Al terminar:**
   - `npm run typecheck` y `npm test` en verde.
   - Explicar paso a paso cómo probarlo a mano en la app.
   - Hacer UN solo commit con mensaje en español.
