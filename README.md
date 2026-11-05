# Gestión de Perfumerías

Sistema web para gestionar locales: **facturación (contado y crédito), créditos y abonos, inventario, notificaciones de cobro y reportes en Excel**.
Funciona en **celular, tablet y computador**, con letra grande y colores de alto contraste pensados para personas adultas.

**Tecnologías:** Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL · Drizzle ORM · Tailwind CSS 4 · ExcelJS · jsPDF

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
| `npm run iconos` | Regenerar los íconos de la PWA desde `src/app/icon.svg` |
| `npm run db:migrate` | Aplicar migraciones pendientes |
| `npm run db:generate` | Crear una migración nueva tras editar `src/db/schema.ts` |
| `npm run db:seed` | Crear el administrador (si no existe) |
| `npm run db:studio` | Ver la base de datos en el navegador |

## 4. Cómo funciona

### Roles
- **Administrador (único):** inicia sesión con identificación `12345987600`. Crea locales, ve y gestiona usuarios (asignar local, editar, cambiar contraseña, pausar/reactivar, eliminar), ve las estadísticas de cada local y descarga reportes Excel del año o del mes.
- **Vendedor:** se registra (nombre, identificación, correo, teléfono, contraseña validada) y queda **en espera** hasta que el administrador le asigna un local. Luego trabaja solo sobre su local.

### Seguridad de sesión
Cada petición se valida contra la base de datos: si el administrador **pausa, elimina o cambia la contraseña** de un usuario, su sesión se cierra al instante.

### Facturación
1. Datos del cliente (si ya compró antes, se autocompletan con la identificación).
2. Buscador inteligente: no distingue mayúsculas ni tildes, y acepta palabras en cualquier orden. Muestra el stock; si no hay, **advierte y no deja vender**.
3. Pago adicional y descuento (valores fijos).
4. **Crédito:** número de cuotas, frecuencia y primera fecha → las fechas se llenan solas y se pueden editar (hora, día, mes y año).

Al registrar, todo ocurre en una **transacción**: se descuenta el inventario, se asigna el consecutivo y se abre la factura lista para **compartir en imagen o PDF**, descargar o imprimir.

### Créditos
Búsqueda por identificación, abonos (se aplican a las cuotas en orden) y cambio de fechas de cobro. Al llegar el saldo a 0 pasa de **Pendiente** a **Completado** y aparece en el historial de ventas completadas.

### Notificaciones
Cobros vencidos, del día y de los próximos 3 días (según las fechas de las cuotas) + productos agotados o con stock bajo. El contador del menú se actualiza cada minuto y, si se activan, llegan avisos del navegador.

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

**Para agregar una función nueva:** tabla en `src/db/schema.ts` → `npm run db:generate` → lógica en `src/server/servicios/` → endpoint en `src/app/api/` → pantalla en `src/app/panel/` o `src/app/admin/`.

## 7. Accesibilidad
- Letra base de 18 px y botones **A / A+ / A++** para agrandarla (se recuerda en el dispositivo).
- Tipografía Atkinson Hyperlegible, diseñada para baja visión.
- Contraste alto (WCAG AA), botones de mínimo 48 px, etiquetas siempre visibles.
- Los estados nunca dependen solo del color: siempre van con texto.
- Navegación completa con teclado y compatible con lectores de pantalla.
