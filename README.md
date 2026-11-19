# Gestión de Perfumerías

Sistema web para gestionar locales: **facturación (contado y crédito), medios de pago, créditos y abonos, clientes, gastos, inventario, notificaciones de cobro y reportes en Excel**.
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
| `npm test` | Pruebas unitarias (búsqueda de productos y clientes, teléfonos, paginación, medios de pago, mensaje de WhatsApp) |
| `npm run iconos` | Regenerar los íconos de la PWA desde `src/app/icon.svg` |
| `npm run db:migrate` | Aplicar migraciones pendientes |
| `npm run db:generate` | Crear una migración nueva tras editar `src/db/schema.ts` |
| `npm run db:seed` | Crear el administrador (si no existe) |
| `npm run db:seed-perfumes -- "Local Centro"` | Cargar perfumes de ejemplo en ese local (ver abajo) |
| `npm run db:recalcular-busqueda` | Recalcular los textos de búsqueda de productos, historial y clientes (una vez, después de migrar) |
| `npm run db:studio` | Ver la base de datos en el navegador |

### Perfumes de ejemplo (para pruebas)

`npm run db:seed-perfumes -- "Nombre del local"` carga en un local que ya exista:

- 8 marcas (Dior, Chanel, Carolina Herrera, Paco Rabanne, Lattafa, Armaf, Rasasi y Afnan).
- 30 perfumes con códigos `DEMO-01` a `DEMO-30`, que cubren Hombre, Mujer, Niño y Niña, los 5 tipos y 5 contenidos (60, 75, 100, 120 y 125 ml).
- Precios según el tipo: Original > 1.1 > Versión / Imitación > Esencia.
- 3 perfumes agotados y 4 en stock bajo, para ver las alertas y las notificaciones.

Se puede ejecutar varias veces sin duplicar: las marcas que ya existen y los códigos `DEMO-xx` que ya están en el local se dejan como están (no se pisan cambios hechos a mano). Si el nombre del local no existe, muestra la lista de locales. No toca al administrador.

## 4. Cómo funciona

### Roles
- **Administrador (único):** inicia sesión con identificación `12345987600`. Crea locales, administra sus **sectores de la ciudad**, sus **marcas** de perfume y sus **categorías de gastos**, ve y gestiona usuarios (asignar local, editar, cambiar contraseña, pausar/reactivar, eliminar), ve las estadísticas y los gastos de cada local y descarga reportes Excel (del año o del mes) por local o el **consolidado de todos los locales**.
- **Vendedor:** se registra (nombre, identificación, correo, teléfono, contraseña validada) y queda **en espera** hasta que el administrador le asigna un local. Luego trabaja solo sobre su local: factura, maneja el inventario (y puede agregar marcas nuevas desde el formulario de producto) y descarga el Excel de **su** local (nunca el de otro).

### Seguridad de sesión
Cada petición se valida contra la base de datos: si el administrador **pausa, elimina o cambia la contraseña** de un usuario, su sesión se cierra al instante.

### Protecciones adicionales
- **Límite de intentos** (`src/server/servicios/limite-intentos.ts`, tabla `limite_intentos`): 5 contraseñas equivocadas para una cuenta → 15 min de bloqueo; 20 fallos desde una misma IP → 30 min; 5 registros por hora por IP; 5 intentos de «contraseña actual» al cambiarla → 15 min. El límite por IP usa `x-forwarded-for`, así que solo es confiable detrás de un proxy o hosting (Vercel, Nginx, Cloudflare).
- **Encabezados de seguridad** en todas las respuestas (`next.config.ts`) y **CSP con nonce** en cada página (`src/middleware.ts`). Si agregas un servicio externo (otra fuente, un script, una API), hay que permitirlo en la CSP.
- **Protección CSRF**: `manejador` rechaza los POST/PUT/PATCH/DELETE que no vienen de la propia aplicación.

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

### Marcas
Cada local tiene sus propias marcas (Dior, Lattafa…). El administrador las maneja en **Locales → Editar → Marcas** igual que los sectores: agregar una o varias, renombrar, desactivar o eliminar. El nombre no se repite en el local aunque cambien las mayúsculas, y una marca que ya se usó en productos solo se desactiva.

El vendedor escribe la marca al crear o editar un producto, con sugerencias de las marcas del local. Si escribe una que no existe, se crea sola al guardar (sin duplicar, aunque cambien las mayúsculas). Si el administrador desactivó una marca, el vendedor no la puede volver a crear.

### Inventario
Cada producto tiene **marca** (obligatoria), **nombre de la fragancia** (obligatorio) y, opcionales: **variante** («Intense», «Tester»), **concentración** (Extrait de Parfum, Parfum, EDP, EDT, EDC, Body Mist, Splash, Otro), **contenido en ml**, **género** (Hombre, Mujer, Unisex) con su **público** (Adulto/Infantil → Niño/Niña), **categoría** (Perfume, Estuche / Set, Body Mist, Crema, Desodorante, Decant, Accesorio, Otro) y **tipo** (Original, 1.1, Imitación, Versión, Esencia). Los productos sin ningún dato aparecen como «Sin categoría».

**Nombre completo.** El servidor lo arma con `armarNombreProducto()` (`src/lib/productos.ts`, con pruebas) al crear o editar: «Marca Nombre Variante · Concentración ml · Género», por ejemplo **«Creed Aventus · EDP 100 ml · Hombre»**, «Victoria's Secret Bombshell · Body Mist 250 ml» o «Estuche Dior Sauvage · EDT 100 ml + gel» (una variante que empieza por «+» va al final). Los campos vacíos no dejan separadores. El formulario muestra una **vista previa en vivo** y avisa si ya existe un producto con la misma marca, nombre, variante, concentración y ml (se puede continuar con confirmación).

El nombre completo se usa en el inventario, el buscador y las líneas de la factura (en 2 líneas: «Creed Aventus» / «EDP 100 ml · Hombre»), la factura (imagen, PDF, WhatsApp), el historial, el récord del cliente, los avisos de stock, los productos más vendidos y todos los Excel. **Cada venta guarda una copia** del nombre completo, la marca, los ml, la concentración y la categoría: editar el producto después no cambia las facturas, y las facturas antiguas conservan su nombre original.

**Búsqueda.** `nombre_busqueda` lleva todos los datos normalizados (marca, nombre, variante, concentración con sigla y nombre largo, ml como «100 ml» y «100ml», género, categoría, tipo y código). Se encuentra con «aventus 100», «creed hombre», «edp 100ml», «100 ml dior» o «sauvage edt», en cualquier orden y sin tildes.

- **Buscar y filtrar:** pestañas Todos | Hombre | Mujer | Unisex, con chips de público, más filtros de marca, categoría, tipo y estado de stock (disponible, bajo, agotado) y el buscador. Los filtros se combinan, se aplican en el servidor y quedan en la dirección (`/panel/inventario?genero=MUJER&categoria=PERFUME`), así se pueden guardar o compartir.
- **En celular y tablet** cada producto es una tarjeta con la **marca en grande**, la fragancia y sus características como insignias; **en escritorio** (desde 1280 px) se ve una tabla con Marca, Fragancia, Características, Género, Tipo, Precio, Stock y Acciones.
- **Agregar unidades:** cantidad y nota opcional (por ejemplo, la factura del proveedor).
- **Vender:** abre **Facturación** con ese perfume ya cargado (`?producto=…`), en contado o en crédito. No hay otro flujo de venta. Si está agotado, el botón lo dice y no deja vender.
- **Detalle:** datos del perfume, sus **últimos 20 movimientos**, y los botones Editar, Ajustar stock y Eliminar.
- **Ajustar stock:** sumar o restar unidades por daño o conteo, con **motivo obligatorio**. Nunca deja el stock en negativo.
- **Editar** un perfume no cambia su stock: las unidades solo cambian con movimientos. Al **eliminar**, si ya se vendió solo se oculta (el historial no cambia).

**Trazabilidad:** cada cambio de stock queda en la tabla `movimientos_inventario` con el tipo (**Ingreso**, **Venta** o **Ajuste**), la cantidad, el stock que quedó, quién lo hizo (se guarda su nombre), la factura (en las ventas) y la nota. La factura registra sus movimientos de venta en la misma transacción que descuenta el stock; crear un perfume con unidades registra un ingreso «Stock inicial».

Para cargar datos de prueba: `npm run db:seed-perfumes -- "Nombre del local"` (ver *Comandos útiles*).

### Gastos
El vendedor los registra en **Gastos** (categoría, valor, medio de pago, fecha y descripción) y los consulta por mes y categoría. El administrador maneja las categorías en **Locales → Editar** y ve los gastos en **Reportes**. Cada local nuevo empieza con 7 categorías.

**Eliminar gasto:** cada gasto tiene el botón rojo «Eliminar gasto», que pide un **motivo** (de 5 a 200 caracteres). El gasto **no se borra**: queda anulado con el motivo, quién y cuándo, y se ve en el filtro **«Eliminados»**. Un vendedor puede eliminar cualquier gasto de **su** local; el administrador, de cualquier local desde **Reportes**. Los gastos eliminados no cuentan en el total del mes, en los totales por medio de pago, en las estadísticas, en la utilidad ni en el Excel.

Las estadísticas y el Excel muestran lo recibido en efectivo y en transferencia, los gastos y la **utilidad (recibido − gastos)**. El Excel incluye las hojas «Gastos» y «Gastos eliminados».

### Créditos
Búsqueda por identificación, abonos con medio de pago (se aplican a las cuotas en orden) y cambio de fechas de cobro. Al llegar el saldo a 0 pasa de **Pendiente** a **Completado** y aparece en el historial de ventas completadas.

La búsqueda por identificación encuentra al **cliente** por su cédula actual y luego sus créditos (por `clienteId`): sigue funcionando aunque la cédula se corrija después de la venta.

### Eliminar venta (anulación)
En **Historial de ventas** y en **Créditos y abonos**, cada venta tiene el botón rojo «Eliminar venta». La confirmación muestra el cliente, el número, el total, los productos que volverán al inventario y, si es un crédito con abonos, cuánto se anulará. Pide un **motivo** obligatorio.

La factura **no se borra**: queda **anulada** con el motivo, quién y cuándo. En una sola transacción:
- se devuelve al inventario la cantidad de cada producto (si el producto estaba oculto, se reactiva; si ya no existe, se avisa);
- si es un crédito, sus cuotas y abonos quedan anulados (no se borran).

Una venta anulada **no cuenta** en estadísticas, reportes, Excel, productos más vendidos, notificaciones de cobro, créditos pendientes, autocompletado de clientes ni en los totales del cliente. Se ve en el filtro **«Anuladas»** del historial (no en «Todas») y en la hoja «Ventas anuladas» del Excel. Su detalle se puede ver, pero no se puede compartir ni volver a anular.

> Los abonos de un crédito anulado dejan de contar como dinero recibido en el mes en que entraron. Si ese dinero sí quedó en caja, regístralo aparte.

### Clientes
En **Clientes** se ven los clientes del local, 10 por página, ordenados por la última compra. La página y la búsqueda quedan en la dirección (`?pagina=2&q=...`), así el botón Atrás del celular funciona.

El buscador acepta nombre, cédula o teléfono y es tolerante: sin tildes ni mayúsculas («jose nunez»), con o sin espacios («carlosruiz», «car rui»), en cualquier orden («ruiz carlos»), números con espacios, puntos, guiones o +57 («315-987-6543», «1.085.999.888») y errores de escritura pequeños («carlso ruis»). Si la cédula o el teléfono coinciden exactamente con un solo cliente, su detalle se abre solo.

El detalle muestra el resumen (compras de contado y a crédito, total comprado y pagado, saldo, créditos pendientes, primera y última compra, producto favorito y ventas anuladas aparte) y el récord de **todas** sus facturas, con filtros por estado. «Editar datos» corrige nombre, cédula, teléfono, dirección y sector: la cédula no puede repetirse en el local, y las facturas antiguas **no** cambian (son el registro de cada venta).

**Errores de escritura (pg_trgm):** la migración intenta crear la extensión `pg_trgm` de PostgreSQL. Si el usuario de la base no tiene permiso, la migración **no falla**: la app funciona igual, pero sin la tolerancia a errores de escritura (la búsqueda sin tildes, espacios, orden y números sigue funcionando). Para activarla luego, un administrador de la base ejecuta:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS clientes_nombre_trgm_idx ON clientes USING gin (nombre_busqueda gin_trgm_ops);
```

y se **reinicia la app**. El índice GIN no está en `schema.ts` (solo en la migración 0004): no uses `npm run db:push`, que lo borraría; usa `npm run db:migrate`.

### Notificaciones
Cobros vencidos, del día y de los próximos 3 días (según las fechas de las cuotas) + productos agotados o con stock bajo. El contador del menú se actualiza cada minuto y, si se activan, llegan avisos del navegador.

### Dashboard de reportes
Arriba de las estadísticas, en **Reportes** (vendedor: su local · administrador: un local o «Todos los locales»), con el año y el mes elegidos:

- **Indicadores:** total vendido, recaudado, unidades vendidas, valor del inventario hoy, cartera pendiente y perfumes agotados.
- **Gráficas:** top 10 perfumes (por unidades o por valor), ventas por Hombre / Niño / Mujer / Niña, por tipo, por marca (top 8 + «Otras») y por contenido en ml, contado y crédito mes a mes con el recaudo, y el inventario de hoy (stock por género y perfumes por reponer, con «Agregar unidades» para el vendedor).

**Qué periodo usa cada cosa:** las ventas, el recaudo, las unidades y las gráficas de ventas usan el año o mes elegido; la gráfica mes a mes muestra siempre los 12 meses del año; el valor del inventario, la cartera, los agotados y la sección de inventario son **de hoy**.

Las ventas por categoría salen de la copia guardada en cada factura (no del producto actual): si luego se reclasifica un perfume, las ventas pasadas no cambian. Las ventas anteriores a la clasificación aparecen como «Sin categoría». El «valor vendido» por categoría es la suma de los productos, sin descuentos ni costos adicionales.

Cada gráfica escribe el nombre y el valor en sus barras, trae sus datos en una tabla para lectores de pantalla y muestra «Aún no hay ventas en este periodo» si no hay datos. En celular los indicadores van de 2 en 2 y una gráfica por fila; en escritorio, 3 indicadores y 2 gráficas por fila.

Todo se calcula en la base de datos (`src/server/servicios/dashboard.ts`, `GET /api/dashboard`): al navegador solo llegan totales. El vendedor siempre ve su local; el administrador elige un local o el consolidado.

### Reportes en Excel
Se descargan desde **Reportes**, del año completo o de un mes.

**Reporte por local** (administrador y vendedor):

| Hoja | Contenido |
|---|---|
| Resumen | Ventas de contado, créditos, abonos, recibido en efectivo/transferencia, gastos y utilidad mes a mes |
| Facturas | Todas las facturas del periodo, con totales |
| Productos vendidos | Unidades y valor vendido por producto (nombre completo de la venta, marca y ml) |
| Ventas por categoría | Unidades y valor vendido por público, tipo, marca y contenido en ml (los mismos cortes del dashboard) |
| Abonos | Cada abono recibido en el periodo |
| Ventas por vendedor | Lo que vendió cada vendedor y su % del total |
| Gastos | Cada gasto del periodo, con categoría y medio de pago |
| Cartera | Créditos con saldo **hoy**: valor vencido, días de atraso y próxima cuota (rojo = más de 30 días, amarillo = algo vencido) |
| Inventario | Stock **hoy** y valor del inventario, con nombre completo, marca, fragancia, variante, concentración, ml, género y categoría (rojo = agotado, amarillo = stock bajo) |

**Consolidado** (solo administrador): hoja *Comparativo locales*, con las cifras de cada local lado a lado y su % de las ventas, hoja *Ventas por categoría* de todos los locales, y hoja *Cartera*, con los créditos pendientes de todos los locales.

> Las hojas *Cartera* e *Inventario* muestran el estado **al momento de descargar**, sin importar el periodo elegido.

### Limpieza del sistema (solo administrador)

En **Limpieza del sistema** el administrador borra datos de un local **de forma definitiva**. Primero elige el local y ve un resumen de lo que tiene.

**Por periodo** (año y uno o varios meses, o todo el año; nunca meses que no han llegado):

| Borra | Conserva |
|---|---|
| Las **ventas de contado** creadas en esos meses (también las anuladas) con sus productos vendidos | **Todos los créditos** con sus cuotas y abonos, aunque se hayan creado o abonado en esos meses |
| Los **gastos** con fecha en esos meses (también los eliminados) | Todos los clientes, todo el inventario (el **stock no cambia**), sectores, categorías, usuarios y la configuración |

Antes de borrar hay que tocar **«Ver qué se va a borrar»** (vista previa: cuántas ventas y gastos, por qué valor, y cuántos créditos y abonos del periodo se conservan).

**Zona de peligro** (borra todo lo de ese tipo, sin importar la fecha):

| Opción | Borra | No toca |
|---|---|---|
| Todas las ventas de contado | Facturas de contado y sus productos vendidos | Créditos, clientes, inventario |
| Todos los créditos | Créditos, cuotas y abonos (avisa cuánto queda por cobrar) | Ventas de contado, clientes, inventario |
| Todos los gastos | Todos los gastos | Lo demás |
| Clientes | Solo los clientes **sin** ventas ni créditos (los demás se conservan y se avisa cuántos) | Facturas |
| Todo el inventario | Productos y su historial de movimientos | Las facturas conservan el nombre del producto |
| TODO el local | Ventas, créditos (cuotas y abonos), gastos, clientes e inventario. Opcional: reiniciar la numeración de facturas a 1 | El local, sus usuarios, sectores, marcas, categorías de gasto, proveedores y compras a proveedores |

**Protecciones** (en todas las opciones):
1. Resumen exacto de lo que se borra y lo que se conserva.
2. **Copia de respaldo obligatoria:** se descarga un Excel con una hoja por tabla, con exactamente lo que se va a borrar. Si la descarga falla, no se borra nada.
3. Escribir `BORRAR <NOMBRE DEL LOCAL>` (no importan las mayúsculas ni los espacios de más).
4. La contraseña del administrador (el servidor la verifica).
5. Una cuenta regresiva de 5 segundos antes de habilitar **«Sí, borrar definitivamente»**.

En el servidor todo ocurre en **una transacción**:
- bloquea el local, así que una factura nueva del mismo local espera a que termine;
- rechaza otra limpieza del mismo local en menos de 30 segundos;
- vuelve a contar y, si los datos cambiaron desde que se descargó el respaldo, **no borra nada**;
- borra en orden: facturas, gastos, clientes y productos;
- deja el registro en el **Historial de limpiezas** (quién, cuándo, qué y cuántos), que la app no permite borrar.

Si algo falla a mitad, PostgreSQL revierte todo. Para probarlo, se puede arrancar el servidor con `LIMPIEZA_SIMULAR_FALLO=1`: la limpieza falla al final y no se borra nada. **Nunca uses esa variable en producción.**

> **Recomendación:** antes de una limpieza grande, haz también un respaldo completo de la base de datos, además del Excel. En Neon basta con crear una *branch*; en cualquier PostgreSQL:
> ```bash
> pg_dump "postgresql://USUARIO:CLAVE@HOST:5432/BASE" -Fc -f respaldo_antes_de_limpiar.dump
> # Para restaurar: pg_restore --clean -d "postgresql://…" respaldo_antes_de_limpiar.dump
> ```

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
│   ├── clientes/        Detalle y récord del cliente
│   └── compartidos/     Estadísticas, gastos y cambio de contraseña
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

**Migración 0004 (anulaciones y clientes):** agrega las columnas de anulación a `facturas`, `cuotas`, `abonos` y `gastos` (todo lo existente queda **vigente**) y las columnas de búsqueda de `clientes`, que se llenan en la misma migración. `npm run db:recalcular-busqueda` las deja idénticas a las de la app. Haz un respaldo (por ejemplo, una *branch* en Neon) antes de migrar.

Para revertirla (primero vuelve a la versión anterior del código; las ventas anuladas volverían a contar, aunque su stock ya se devolvió):

```sql
DROP INDEX IF EXISTS clientes_nombre_trgm_idx, clientes_local_nombre_busqueda_idx, clientes_local_telefono_idx,
  facturas_local_anulada_idx, facturas_cliente_idx, gastos_local_anulado_idx;
ALTER TABLE facturas DROP COLUMN anulada, DROP COLUMN anulada_en, DROP COLUMN anulada_por_id, DROP COLUMN anulada_por_nombre, DROP COLUMN motivo_anulacion;
ALTER TABLE gastos DROP COLUMN anulado, DROP COLUMN anulado_en, DROP COLUMN anulado_por_id, DROP COLUMN anulado_por_nombre, DROP COLUMN motivo_anulacion;
ALTER TABLE cuotas DROP COLUMN anulada;
ALTER TABLE abonos DROP COLUMN anulado;
ALTER TABLE clientes DROP COLUMN nombre_busqueda, DROP COLUMN nombre_compacto, DROP COLUMN telefono_digitos;
DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations);
```

**Migraciones 0005 y 0006 (características del producto):**
- La 0005 agrega `variante`, `concentracion`, `contenido_ml`, `categoria` y `nombre_completo` a `productos`; `contenido_ml`, `concentracion` y `categoria` a `factura_items`, y el género **Unisex**. Convierte el tamaño viejo a ml (2 oz → 60, 2.5 → 75, 3.4 → 100, 4 → 120, 4.2 → 125) en productos **y** en las ventas guardadas, marca como «Perfume» los productos ya clasificados y deja `nombre_completo` = nombre actual.
- La 0006 quita la columna `tamano` y su tipo (los datos ya quedaron en ml).
- Después ejecuta `npm run db:recalcular-busqueda`: arma el nombre completo y la búsqueda de cada producto con la misma función de la app. **Las facturas no se modifican.**

Para revertirlas (vuelve primero a la versión anterior del código; con un respaldo es más seguro):

```sql
CREATE TYPE tamano_producto AS ENUM ('OZ_2','OZ_2_5','OZ_3_4','OZ_4','OZ_4_2');
ALTER TABLE productos ADD COLUMN tamano tamano_producto;
ALTER TABLE factura_items ADD COLUMN tamano tamano_producto;
UPDATE productos SET tamano = (CASE contenido_ml WHEN 60 THEN 'OZ_2' WHEN 75 THEN 'OZ_2_5' WHEN 100 THEN 'OZ_3_4' WHEN 120 THEN 'OZ_4' WHEN 125 THEN 'OZ_4_2' END)::tamano_producto;
UPDATE factura_items SET tamano = (CASE contenido_ml WHEN 60 THEN 'OZ_2' WHEN 75 THEN 'OZ_2_5' WHEN 100 THEN 'OZ_3_4' WHEN 120 THEN 'OZ_4' WHEN 125 THEN 'OZ_4_2' END)::tamano_producto;
ALTER TABLE productos DROP COLUMN variante, DROP COLUMN concentracion, DROP COLUMN contenido_ml, DROP COLUMN categoria, DROP COLUMN nombre_completo;
ALTER TABLE factura_items DROP COLUMN contenido_ml, DROP COLUMN concentracion, DROP COLUMN categoria;
DROP TYPE concentracion; DROP TYPE categoria_producto;
DELETE FROM drizzle.__drizzle_migrations WHERE id IN (SELECT id FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 2);
-- El valor UNISEX del tipo "genero" no se puede quitar en PostgreSQL; si algún producto lo usa, cámbialo antes a HOMBRE o MUJER.
```

**Migración 0010 (limpieza del sistema):** crea la tabla `limpiezas` (historial de auditoría). Para revertirla: `DROP TABLE limpiezas; DROP TYPE alcance_limpieza;` y borrar su fila de `drizzle.__drizzle_migrations`.

> **Ojo con las migraciones de fechas antiguas.** `npm run db:migrate` solo aplica las migraciones con fecha **posterior** a la última registrada en la base. Si al unir ramas aparece una migración nueva con una fecha anterior (pasó con 0004, 0005 y 0006), `db:migrate` la salta sin avisar. Para comprobarlo, compara `drizzle/meta/_journal.json` con `SELECT created_at FROM drizzle.__drizzle_migrations`: cada `when` del journal debe estar en la base.

**Para agregar una función nueva:** tabla en `src/db/schema.ts` → `npm run db:generate` → lógica en `src/server/servicios/` → endpoint en `src/app/api/` → pantalla en `src/app/panel/` o `src/app/admin/`.

## 7. Accesibilidad
- Letra base de 18 px y botones **A / A+ / A++** para agrandarla (se recuerda en el dispositivo).
- Tipografía Atkinson Hyperlegible, diseñada para baja visión.
- Contraste alto (WCAG AA), botones de mínimo 48 px, etiquetas siempre visibles.
- Los estados nunca dependen solo del color: siempre van con texto.
- Las secciones desplegables funcionan con teclado y respetan la preferencia de reducir el movimiento.
- Navegación completa con teclado y compatible con lectores de pantalla.
