# Pendientes de UX (auditoría del 11 de noviembre de 2026)

Auditoría heurística de la vista del vendedor (Nielsen, principios visuales y WCAG 2.2 AA),
hecha sobre la app en local a 360, 768 y 1280 px.

Los arreglos rápidos ya están en el commit `2e5d1c7`. Lo que sigue son los cambios grandes,
en orden de impacto contra esfuerzo. Para cada uno: plan por archivo y OK antes de codificar
(regla 2 de `CLAUDE.md`).

| # | Cambio | Severidad (0–4) | Esfuerzo |
|---|--------|-----------------|----------|
| 1 | ~~Guardar el borrador de la factura~~ (hecho) | 4 | Medio |
| 2 | Total y "Registrar" siempre visibles | 3 | Medio |
| 3 | Quitar el scroll interno de la lista de productos | 3 | Medio |
| 4 | Insignia "Cobrar hoy" / "Vencido" en Créditos | 2 | Bajo |
| 5 | Tarjeta de producto apilada en celular | 2 | Bajo |

## 1. Guardar el borrador de la factura (hecho)
- **Hecho:** `src/lib/borrador-factura.ts` (+ test). Se guarda en `sessionStorage`, vence a
  las 12 horas y se borra al registrar, con "Limpiar todo", con "Descartar borrador" y al
  cerrar sesión. También conserva el cliente y los productos al cambiar entre Factura normal
  y Crédito, y al recargar abre la misma pestaña.
- **Riesgo que queda:** si la sesión se cierra sola (cuenta pausada), el borrador sigue en esa
  pestaña hasta que vence o se cierra la pestaña.

Lo que se había planteado:
- **Problema:** si se recarga la página, la factura a medio llenar se pierde sin aviso
  (agregué Afnan 9PM, recargué y quedó "Productos en la factura (0)").
- **Dónde:** `src/components/facturacion/FormularioFactura.tsx`.
- **Propuesta:**
  - Guardar el cliente, las líneas, el tipo, el medio de pago, el descuento, el costo
    adicional y las notas en `sessionStorage`, con try/catch.
  - Al volver, restaurarlo y mostrar el aviso "Recuperamos tu factura sin terminar · Descartar".
  - Borrar el borrador al registrar o al pulsar "Limpiar todo".
  - Avisar con `beforeunload` si hay productos agregados.
- **Ojo:** al restaurar, volver a validar el stock y el precio contra el servidor; nunca
  confiar en el borrador.
- **Falta comprobar:** si también se pierde al navegar dentro de la app. Solo se probó la recarga.

## 2. Total y "Registrar" siempre visibles
- **Problema:** el total y el botón están al final de una página muy larga. Mientras se
  agregan productos no se ve cuánto va la cuenta.
- **Dónde:** `FormularioFactura.tsx` (resumen) y `src/app/panel/facturacion/page.tsx`.
- **Propuesta:**
  - En celular: una barra fija abajo con "Total $ X · N productos" y el botón Registrar,
    de al menos 48 px.
  - En escritorio: una columna derecha con el resumen fijo (`sticky`).

## 3. Quitar el scroll interno de la lista de productos
- **Problema:** la lista tiene una altura fija (`max-h-[18rem] overflow-y-auto`), muestra
  unas 3 tarjetas y en el celular atrapa el dedo.
- **Dónde:** `src/components/facturacion/BuscadorProductos.tsx`.
- **Propuesta:**
  - Mostrar resultados solo cuando se escribe en "Buscar producto", o los 5 más vendidos
    mientras el campo está vacío.
  - Que la lista crezca con la página.

## 4. Insignia "Cobrar hoy" / "Vencido" en Créditos
- **Problema:** un crédito que se cobra hoy tiene la misma insignia "Pendiente" que uno
  que se cobra en meses.
- **Dónde:** `src/app/panel/creditos/GestionCreditos.tsx`.
- **Propuesta:**
  - Insignias "Cobrar hoy" (colores `alerta-*`) y "Vencido" (colores `peligro-*`), siempre
    con ícono y texto, no solo color.
  - Ordenar la lista por la fecha del próximo cobro.

## 5. Tarjeta de producto apilada en celular
- **Problema:** a 360 px el nombre del producto se parte palabra por palabra, porque el
  precio, el stock y el botón + ocupan el lado derecho.
- **Dónde:** `BuscadorProductos.tsx` (tarjeta de producto).
- **Propuesta:** por debajo de `sm`, el nombre arriba a todo el ancho y, debajo, una fila
  con precio, stock y botón +.

## Otros detalles menores
- En Crédito, el número de cuotas es una lista larga (1, 2, 3… cuotas). Cambiarla por botones
  rápidos (2, 3, 4, 6 y "Otro…").

## Sin evaluar todavía
- Login.
- Pantallas de ADMIN.
- Inventario, Gastos y Reportes.
- Confirmación después de registrar y PDF de la factura.
- Página sin conexión.
