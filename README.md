# Gestión de Perfumerías

Sistema web para gestionar locales: **facturación (contado y crédito), medios de pago, créditos y abonos, gastos, inventario, notificaciones de cobro y reportes en Excel**.
Funciona en **celular, tablet y computador**, con letra grande y colores de alto contraste pensados para personas adultas.

**Tecnologías:** Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL · Drizzle ORM · Tailwind CSS 4 · Recharts 3 · ExcelJS · jsPDF

---

## 1. Requisitos

- Node.js 20 o superior
- PostgreSQL 14 o superior

## 2. Instalación (paso a paso)

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de configuración y editarlo con los datos de TU base de datos
cp .env.example .env

# 3. Crear las tablas y el usuario administrador
npm run setup

# 4. Iniciar en modo desarrollo
npm run dev
```

Abre **http://localhost:3000**

### Variables del archivo `.env`

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL: `postgresql://usuario:clave@host:5432/base` |
| `AUTH_SECRET` | Clave para firmar sesiones (mínimo 32 caracteres, ¡cámbiala!) |
| `ADMIN_IDENTIFICACION` | Identificación del administrador (`12345987600`) |
| `ADMIN_PASSWORD` | Contraseña inicial del administrador |

> El administrador se crea **una sola vez**. Si luego cambia su contraseña desde «Mi cuenta», volver a ejecutar `npm run db:seed` **no** la sobrescribe.

### Producción

```bash
npm run build
npm run start
```

## 3. Comandos útiles

| Comando | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilar y ejecutar en producción |
| `npm run typecheck` | Revisar errores de TypeScript |
| `npm test` | Pruebas unitarias (búsqueda, medios de pago, mensaje de WhatsApp) |
| `npm run iconos` | Regenerar los íconos de la PWA desde `src/app/icon.svg` |
| `npm run db:migrate` | Aplicar migraciones pendientes |
| `npm run db:generate` | Crear una migración nueva tras editar `src/db/schema.ts` |
| `npm run db:seed` | Crear el administrador (si no existe) |
| `npm run db:seed-perfumes -- "Local Centro"` | Cargar perfumes de ejemplo en ese local (ver abajo) |
| `npm run db:recalcular-busqueda` | Recalcular los textos de búsqueda de productos e historial (una vez, después de migrar) |
| `npm run db:studio` | Ver la base de datos en el navegador |

### Perfumes de ejemplo (para pruebas)

`npm run db:seed-perfumes -- "Nombre del local"` carga en un local que ya exista:

- 8 marcas (Dior, Chanel, Carolina Herrera, Paco Rabanne, Lattafa, Armaf, Rasasi y Afnan).
- 30 perfumes con códigos `DEMO-01` a `DEMO-30`, que cubren Hombre, Mujer, Niño y Niña, los 5 tipos y los 5 tamaños.
- Precios según el tipo: Original > 1.1 > Versión / Imitación > Esencia.
- 3 perfumes agotados y 4 en stock bajo, para ver las alertas y las notificaciones.

Se puede ejecutar varias veces sin duplicar: las marcas que ya existen y los códigos `DEMO-xx` que ya están en el local se dejan como están (no se pisan cambios hechos a mano). Si el nombre del local no existe, muestra la lista de locales. No toca al administrador.

## 4. Cómo funciona

### Roles
- **Administrador (único):** inicia sesión con identificación `12345987600`. Crea locales, administra sus **sectores de la ciudad** y sus **categorías de gastos**, ve y gestiona usuarios (asignar local, editar, cambiar contraseña, pausar/reactivar, eliminar), ve las estadísticas y los gastos de cada local y descarga reportes Excel (del año o del mes) por local o el **consolidado de todos los locales**.
- **Vendedor:** se registra (nombre, identificación, correo, teléfono, contraseña validada) y queda **en espera** hasta que el administrador le asigna un local. Luego trabaja solo sobre su local, y puede descargar el Excel de **su** local (nunca el de otro).

### Seguridad de sesión
Cada petición se valida contra la base de datos: si el administrador **pausa, elimina o cambia la contraseña** de un usuario, su sesión se cierra al instante.

### Facturación
1. Datos del cliente (si ya compró antes, se autocompletan con la identificación). El **sector** se elige de la lista del local; si el local no tiene sectores, no se puede registrar la factura.
2. Lista de productos siempre visible, con filtro desde la primera letra: ignora mayúsculas, tildes, ñ y signos, y acepta palabras en cualquier orden. Muestra el stock; si no hay, **advierte y no deja vender**.
3. Secciones desplegables opcionales: **Aplicar descuento**, **Costo adicional** y **Notas**. Si tienen un valor, se ve aunque estén cerradas.
4. **Factura normal:** medio de pago (Efectivo, Transferencia o Mixto). En Mixto se escribe la transferencia y el efectivo se calcula solo.
5. **Crédito:** número de cuotas, frecuencia y primera fecha → las fechas se llenan solas y se pueden editar (hora, día, mes y año). El medio de pago se registra en cada abono.

Al registrar, todo ocurre en una **transacción**: se descuenta el inventario, se asigna el consecutivo y se abre la factura lista para **enviar por WhatsApp**, **compartir en imagen o PDF**, descargar o imprimir. El servidor recalcula el total y el reparto del pago: nunca confía en los valores del navegador.

**Enviar por WhatsApp:** abre `wa.me` con el celular del cliente (agrega el 57) y el detalle de la factura en texto. WhatsApp no permite adjuntar la imagen desde un enlace; para enviarla se usa «Compartir imagen». El teléfono debe ser un celular colombiano de 10 dígitos.

### Sectores
En **Locales → Sectores de la ciudad** el administrador agrega sectores (uno a uno o pegando varios, uno por línea), los edita y los elimina. Si un sector ya se usó en facturas solo se desactiva. La factura guarda el nombre del sector, así el historial no cambia.

### Gastos
El vendedor los registra en **Gastos** (categoría, valor, medio de pago, fecha y descripción), los consulta por mes y categoría, y puede eliminar solo los suyos registrados ese día. El administrador maneja las categorías en **Locales → Editar** y ve los gastos en **Reportes**. Cada local nuevo empieza con 7 categorías.

Las estadísticas y el Excel muestran lo recibido en efectivo y en transferencia, los gastos y la **utilidad (recibido − gastos)**. El Excel incluye la hoja «Gastos».

### Créditos
Búsqueda por identificación, abonos con medio de pago (se aplican a las cuotas en orden) y cambio de fechas de cobro. Al llegar el saldo a 0 pasa de **Pendiente** a **Completado** y aparece en el historial de ventas completadas.

### Notificaciones
Cobros vencidos, del día y de los próximos 3 días (según las fechas de las cuotas) + productos agotados o con stock bajo. El contador del menú se actualiza cada minuto y, si se activan, llegan avisos del navegador.

### Dashboard de reportes
Arriba de las estadísticas, en **Reportes** (vendedor: su local · administrador: un local o «Todos los locales»), con el año y el mes elegidos:

- **Indicadores:** total vendido, recaudado, unidades vendidas, valor del inventario hoy, cartera pendiente y perfumes agotados.
- **Gráficas:** top 10 perfumes (por unidades o por valor), ventas por Hombre / Niño / Mujer / Niña, por tipo, por marca (top 8 + «Otras») y por tamaño, contado y crédito mes a mes con el recaudo, y el inventario de hoy (stock por género y perfumes por reponer, con «Agregar unidades» para el vendedor).

Las ventas por categoría salen de la copia guardada en cada factura (no del producto actual); las ventas anteriores a la clasificación aparecen como «Sin categoría». Todo se calcula en la base de datos (`src/server/servicios/dashboard.ts`, `GET /api/dashboard`).

### Reportes en Excel
Se descargan desde **Reportes**, del año completo o de un mes.

**Reporte por local** (administrador y vendedor):

| Hoja | Contenido |
|---|---|
| Resumen | Ventas de contado, créditos, abonos, recibido en efectivo/transferencia, gastos y utilidad mes a mes |
| Facturas | Todas las facturas del periodo, con totales |
| Productos vendidos | Unidades y valor vendido por producto |
| Ventas por categoría | Unidades y valor vendido por público, tipo, marca y tamaño (los mismos cortes del dashboard) |
| Abonos | Cada abono recibido en el periodo |
| Ventas por vendedor | Lo que vendió cada vendedor y su % del total |
| Gastos | Cada gasto del periodo, con categoría y medio de pago |
| Cartera | Créditos con saldo **hoy**: valor vencido, días de atraso y próxima cuota (rojo = más de 30 días, amarillo = algo vencido) |
| Inventario | Stock **hoy** y valor del inventario (rojo = agotado, amarillo = stock bajo) |

**Consolidado** (solo administrador): hoja *Comparativo locales*, con las cifras de cada local lado a lado y su % de las ventas, hoja *Ventas por categoría* de todos los locales, y hoja *Cartera*, con los créditos pendientes de todos los locales.

> Las hojas *Cartera* e *Inventario* muestran el estado **al momento de descargar**, sin importar el periodo elegido.

## 5. Instalar como aplicación (PWA)

La app se puede instalar en celular, tablet y computador, y se abre en su propia ventana, sin barra del navegador.

> **Requisito en producción: HTTPS.** Sin un dominio con HTTPS no se puede instalar ni funciona el service worker. La única excepción es `http://localhost`, para pruebas.

**Android (Chrome):** entra a la app y toca **Instalar aplicación**, en la pantalla de inicio de sesión o en el menú. También sirve el menú ⋮ de Chrome → **Instalar aplicación**.

**iPhone o iPad (Safari):** toca **Compartir** → **Agregar a pantalla de inicio** → **Agregar**. El botón **Instalar aplicación** muestra estos mismos pasos.

**Computador (Chrome o Edge):** haz clic en **Instalar aplicación** o en el ícono de instalar de la barra de direcciones.

### Regenerar los íconos

Si cambias `src/app/icon.svg`, ejecuta:

```bash
npm run iconos
```

Los archivos quedan en `public/icons/`.

### Funcionamiento y seguridad

- El service worker (`public/sw.js`) solo se activa en producción (`npm run build` + `npm run start`), no en `npm run dev`.
- Solo guarda archivos estáticos, íconos, fuentes y la página `/offline`. **Nunca** guarda `/api/*`, páginas con datos del usuario ni descargas, porque varios vendedores pueden usar el mismo dispositivo.
- Sin conexión no se puede consultar ni registrar nada: se muestra la página «Sin conexión».
- Cada `npm run build` genera una versión nueva. Quien abra la app después de publicarla verá el aviso «Hay una nueva versión disponible».
- Los recordatorios de cobro solo llegan con la app abierta. Web Push en segundo plano está pendiente (ver el TODO al final de `public/sw.js`).

## 6. Estructura del proyecto

```
drizzle/                 Migraciones SQL generadas
public/                  Service worker (sw.js) e íconos de la PWA
scripts/                 Generador de íconos
src/
├── app/
│   ├── (auth)/          Login y registro (públicas)
│   ├── admin/           Pantallas del administrador
│   ├── panel/           Pantallas del vendedor
│   └── api/             Endpoints REST (cada uno valida rol y datos)
├── components/
│   ├── ui/              Botones, campos, ventanas, avisos (accesibles)
│   ├── layout/          Marco con menú y control de tamaño de letra
│   ├── facturacion/     Formulario, buscador, cuotas, vista de factura
│   ├── pwa/             Registro del service worker y botón de instalar
│   └── compartidos/     Estadísticas y cambio de contraseña
├── db/                  Esquema, conexión y seed
├── lib/                 Sesión, validaciones (Zod), formatos, helpers de API
├── server/servicios/    Lógica de negocio (facturas, créditos, reportes…)
├── tipos/               Tipos compartidos entre API y pantallas
└── middleware.ts        Protección de rutas por rol
```

### Actualizar una instalación existente

```bash
npm run db:migrate              # crea las tablas nuevas y completa los datos existentes
npm run db:recalcular-busqueda  # recalcula los textos de búsqueda
```

Después, el administrador debe **agregar los sectores de cada local**: sin ellos no se pueden registrar facturas. Las ventas de contado existentes quedan como pagadas en efectivo, igual que los abonos existentes. Los créditos no tienen medio de pago propio.

**Para agregar una función nueva:** tabla en `src/db/schema.ts` → `npm run db:generate` → lógica en `src/server/servicios/` → endpoint en `src/app/api/` → pantalla en `src/app/panel/` o `src/app/admin/`.

## 7. Accesibilidad
- Letra base de 18 px y botones **A / A+ / A++** para agrandarla (se recuerda en el dispositivo).
- Tipografía Atkinson Hyperlegible, diseñada para baja visión.
- Contraste alto (WCAG AA), botones de mínimo 48 px, etiquetas siempre visibles.
- Los estados nunca dependen solo del color: siempre van con texto.
- Las secciones desplegables funcionan con teclado y respetan la preferencia de reducir el movimiento.
- Navegación completa con teclado y compatible con lectores de pantalla.
