/**
 * Manual de usuario (pantalla Ajustes → Manual de usuario).
 * Fuente: «Manual de usuario — Gestión de Perfumerías» (11 nov 2026), con el texto ajustado a como se ve hoy la app:
 *  - El menú dice «Ajustes» (antes «Mi cuenta») y el tamaño de letra se cambia en Ajustes → Apariencia.
 *  - Cada rol ve solo sus secciones; las referencias «(sección N)» solo apuntan a secciones que ese rol ve
 *    (lo comprueba manual.test.ts). Un bloque con `roles` solo se muestra a esos roles.
 * Formato del texto: **negrita** entre dos asteriscos dobles; `tramos()` lo separa para dibujarlo.
 */

export type RolManual = "ADMIN" | "VENDEDOR";

export type BloqueManual = (
  | { tipo: "parrafo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "numerada"; items: string[] }
  | { tipo: "vinetas"; items: string[] }
  | { tipo: "tabla"; columnas: string[]; filas: string[][] }
) & { roles?: RolManual[] };

export interface SeccionManual {
  numero: number;
  titulo: string;
  roles: RolManual[];
  bloques: BloqueManual[];
}

const VENDEDOR: RolManual[] = ["VENDEDOR"];
const ADMIN: RolManual[] = ["ADMIN"];
const AMBOS: RolManual[] = ["VENDEDOR", "ADMIN"];

export const MANUAL: SeccionManual[] = [
  {
    numero: 1,
    titulo: "Antes de empezar",
    roles: AMBOS,
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "Gestión de Perfumerías reemplaza el cuaderno y los chats de WhatsApp: aquí se registran las ventas, los créditos, los abonos, el inventario y los gastos, y el sistema saca las cuentas solo.",
      },
      {
        tipo: "parrafo",
        texto:
          "Funciona en celular, tablet y computador con la misma cuenta. Lo que registras en el celular aparece en el computador, y al revés. Necesita internet: sin conexión muestra la pantalla «Sin conexión» y no deja consultar ni registrar nada.",
      },
      { tipo: "subtitulo", texto: "Hay dos tipos de cuenta" },
      {
        tipo: "tabla",
        columnas: ["Cuenta", "Para qué sirve", "Qué ve en el menú"],
        filas: [
          [
            "Vendedor",
            "El trabajo de todos los días: vender, cobrar, manejar inventario y gastos de su local",
            "Facturación, Historial de ventas, Créditos y abonos, Gastos, Notificaciones, Inventario, Reportes y estadísticas, Ajustes",
          ],
          [
            "Administrador",
            "Organizar el negocio: crear locales, sectores, marcas y categorías, y dar acceso a los vendedores",
            "Inicio, Usuarios, Locales, Reportes, Ajustes",
          ],
        ],
      },
      {
        tipo: "parrafo",
        roles: ADMIN,
        texto:
          "El administrador no vende. Si una sola persona maneja el negocio, necesita las dos cuentas: la de administrador para configurar y una de vendedor para vender. La sección 2 explica cómo dejarlas listas.",
      },
      {
        tipo: "parrafo",
        roles: VENDEDOR,
        texto:
          "El administrador no vende. Si una sola persona maneja el negocio, necesita las dos cuentas: la de administrador para configurar y una de vendedor para vender.",
      },
      { tipo: "subtitulo", texto: "Instalar la aplicación" },
      { tipo: "parrafo", texto: "No se descarga de una tienda. Se abre la dirección del sistema en el navegador y se instala desde ahí." },
      {
        tipo: "vinetas",
        items: [
          "**Android (Chrome):** toca **Instalar aplicación** en la pantalla de inicio de sesión o en el menú.",
          "**iPhone o iPad (Safari):** toca **Compartir**, luego **Agregar a pantalla de inicio** y por último **Agregar**.",
          "**Computador (Chrome o Edge):** haz clic en **Instalar aplicación**.",
        ],
      },
      {
        tipo: "parrafo",
        texto: "Después queda un ícono como cualquier otra aplicación. Si aparece el aviso «Hay una nueva versión disponible», toca **Actualizar ahora**.",
      },
    ],
  },
  {
    numero: 2,
    titulo: "Primera configuración (se hace una sola vez)",
    roles: ADMIN,
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "Antes de la primera venta el local necesita cuatro cosas: existir, tener sectores, tener marcas y tener un vendedor asignado. Sin sectores el sistema no deja registrar facturas.",
      },
      {
        tipo: "numerada",
        items: [
          "**Entra como administrador.** Usa el número de identificación y la contraseña de administrador que te entregaron al instalar el sistema.",
          "**Crea el local.** Ve a **Locales**, toca **Crear local**, escribe el nombre (dirección y teléfono son opcionales, pero salen impresos en la factura) y toca **Guardar**.",
          "**Agrega los sectores de la ciudad.** En la tarjeta del local toca **Sectores de la ciudad**. Escribe cada sector y toca **Agregar**, o abre **Pegar varios a la vez**, escribe uno por línea y toca **Agregar todos**.",
          "**Agrega las marcas.** En la tarjeta del local toca **Editar** y baja hasta **Marcas**. Son las casas de perfume (Dior, Lattafa, etc.). El vendedor también puede agregar marcas después, al crear un perfume.",
          "**Revisa las categorías de gastos.** En esa misma ventana, más abajo, está **Categorías de gastos**. El local nace con 7 categorías ya creadas; agrega o cambia las que necesites.",
          "**Crea la cuenta de vendedor.** Toca **Cerrar sesión**. En la pantalla de inicio toca **Crear una cuenta** y completa nombre, identificación, teléfono, correo y contraseña. Aparece el mensaje «¡Tu cuenta fue creada!».",
          "**Asigna el local al vendedor.** Entra otra vez como administrador, ve a **Usuarios**, toca el filtro **En espera de local**, busca la cuenta nueva, toca **Asignar local**, elige el local y confirma.",
          "**Entra como vendedor.** Cierra sesión e ingresa con la identificación y la contraseña de la cuenta de vendedor. Ya puedes cargar el inventario y vender.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "La cuenta de vendedor debe usar una identificación y un correo distintos a los del administrador: el sistema no acepta dos cuentas con el mismo número ni con el mismo correo.",
      },
      { tipo: "subtitulo", texto: "La contraseña debe tener" },
      {
        tipo: "vinetas",
        items: ["Mínimo 8 caracteres", "Una letra MAYÚSCULA", "Una letra minúscula", "Un número", "Un símbolo (por ejemplo $ # @ ! *)"],
      },
      { tipo: "parrafo", texto: "Mientras escribes, la pantalla marca con un chulo cada requisito que ya se cumple." },
    ],
  },
  {
    numero: 3,
    titulo: "Entrar y moverse por el sistema",
    roles: AMBOS,
    bloques: [
      {
        tipo: "parrafo",
        texto: "Se entra con el número de identificación y la contraseña; el sistema te lleva solo a tu pantalla según el tipo de cuenta.",
      },
      {
        tipo: "numerada",
        items: [
          "Abre la aplicación.",
          "Escribe tu **Número de identificación** (solo números, sin puntos).",
          "Escribe tu **Contraseña**.",
          "Toca **Entrar**. El vendedor llega a **Facturación**; el administrador llega a **Inicio**.",
        ],
      },
      { tipo: "subtitulo", texto: "El menú" },
      {
        tipo: "vinetas",
        items: [
          "**En computador:** el menú está siempre visible a la izquierda.",
          "**En celular:** toca el botón **Menú**, arriba a la derecha. Si tiene un número rojo encima, hay cobros para hoy o vencidos.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "Al final del menú están **Instalar aplicación**, **Activar avisos de cobro** y **Cerrar sesión**. El tamaño de letra se cambia en **Ajustes** (sección 14).",
      },
      { tipo: "subtitulo", texto: "Salir" },
      { tipo: "parrafo", texto: "Toca **Cerrar sesión** al final del menú. Hazlo siempre que el celular o el computador lo use otra persona." },
      {
        tipo: "parrafo",
        texto: "Si aparece «Tu sesión terminó», vuelve a escribir tus datos. Pasa cuando el administrador cambia tu contraseña o pausa tu cuenta.",
      },
    ],
  },
  {
    numero: 4,
    titulo: "Registrar una venta de contado",
    roles: VENDEDOR,
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "Una venta de contado se registra en **Facturación**, pestaña **Factura normal**, en tres pasos: cliente, productos y medio de pago. Al guardarla, el inventario se descuenta solo.",
      },
      {
        tipo: "numerada",
        items: [
          "En el menú toca **Facturación** y deja marcada la pestaña **Factura normal** («El cliente paga todo ahora»).",
          "**Datos del cliente.** Escribe la **Identificación del cliente**. Si ya compró antes, el nombre, el teléfono, la dirección y el sector se llenan solos. Si es nuevo, complétalos y elige el **Sector** de la lista.",
          "**Productos.** Escribe parte del nombre o el código en **Buscar producto**. No importan mayúsculas ni tildes. Toca el botón **+** del perfume para agregarlo.",
          "Ajusta la cantidad con los botones **−** y **+**. Para sacar un perfume de la factura toca **Quitar**.",
          "**Opcional.** Abre **Aplicar descuento** para restar un valor, **Costo adicional** para sumar uno (por ejemplo el domicilio) o **Notas** para dejar un comentario en la factura.",
          "**Medio de pago.** Elige **Efectivo**, **Transferencia** o **Mixto**. En Mixto escribes cuánto llegó por transferencia y el efectivo se calcula solo.",
          "Revisa el **Total** y toca **Registrar factura**.",
          "Se abre la factura lista para enviar al cliente (sección 6).",
        ],
      },
      { tipo: "subtitulo", texto: "Para tener en cuenta" },
      {
        tipo: "vinetas",
        items: [
          "Cada perfume muestra su stock. Si dice **Sin stock**, no se puede vender; primero hay que agregar unidades en el inventario.",
          "No se pueden vender más unidades de las que hay.",
          "El teléfono del cliente debe ser un celular de 10 dígitos para poder enviarle la factura por WhatsApp.",
          "**Limpiar todo** borra lo que llevas escrito y deja la factura en blanco.",
          "Desde **Inventario** también se puede empezar: el botón **Vender** de un perfume abre Facturación con ese perfume ya agregado.",
        ],
      },
    ],
  },
  {
    numero: 5,
    titulo: "Registrar una venta a crédito",
    roles: VENDEDOR,
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "Una venta a crédito se registra igual que la de contado, pero en la pestaña **Crédito**: en lugar del medio de pago se definen las cuotas y sus fechas de cobro.",
      },
      {
        tipo: "numerada",
        items: [
          "En **Facturación** toca la pestaña **Crédito** («El cliente paga en cuotas»).",
          "Completa los **Datos del cliente** y agrega los **Productos**, igual que en la sección 4.",
          "En **Cuotas del crédito** elige el **Número de cuotas** (de 1 a 24).",
          "Elige **Cada cuánto paga**: cada semana, cada 15 días o cada mes.",
          "Elige la **Fecha y hora del primer pago**. Las demás fechas se calculan solas.",
          "Si el cliente pidió un día distinto para alguna cuota, cambia esa fecha en la lista de abajo.",
          "Toca **Registrar crédito**. Se abre la factura con el plan de pagos.",
        ],
      },
      { tipo: "subtitulo", texto: "Para tener en cuenta" },
      {
        tipo: "vinetas",
        items: [
          "El sistema propone 3 cuotas mensuales, la primera dentro de un mes a las 10:00 a. m. Se puede cambiar todo.",
          "El total se reparte en cuotas iguales; si la división no es exacta, la última cuota lleva la diferencia.",
          "Todas las fechas de cobro deben ser futuras.",
          "Si el cliente deja una parte el mismo día, registra el crédito por el total y enseguida regístrale un abono (sección 7). El crédito no pide pago inicial.",
          "Las fechas de las cuotas son las que después generan los recordatorios en **Notificaciones**.",
        ],
      },
    ],
  },
  {
    numero: 6,
    titulo: "Enviar la factura al cliente",
    roles: VENDEDOR,
    bloques: [
      { tipo: "parrafo", texto: "Apenas se registra una venta, la factura se abre con cinco botones para entregarla." },
      {
        tipo: "tabla",
        columnas: ["Botón", "Qué hace"],
        filas: [
          [
            "**Enviar por WhatsApp al cliente**",
            "Abre WhatsApp en el chat del cliente con el detalle de la factura escrito como mensaje. Solo falta tocar enviar.",
          ],
          [
            "**Compartir imagen**",
            "Crea una imagen de la factura. En celular abre el menú de compartir (WhatsApp, correo, etc.); en computador la descarga.",
          ],
          ["**Compartir PDF**", "Lo mismo, pero en PDF."],
          ["**Descargar PDF**", "Guarda el PDF en el dispositivo."],
          ["**Imprimir**", "Imprime solo la factura."],
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "El botón de WhatsApp envía texto, no la imagen. Para que al cliente le llegue la factura como foto, usa **Compartir imagen** y elige WhatsApp en el menú.",
      },
      {
        tipo: "parrafo",
        texto: "La factura se puede volver a abrir y compartir cuando quieras desde **Historial de ventas** (sección 8).",
      },
    ],
  },
  {
    numero: 7,
    titulo: "Créditos y abonos",
    roles: VENDEDOR,
    bloques: [
      {
        tipo: "parrafo",
        texto: "En **Créditos y abonos** se ve quién debe, cuánto debe y cuándo le toca pagar, y se registra cada pago que hace el cliente.",
      },
      {
        tipo: "parrafo",
        texto:
          "Al entrar aparecen todos los créditos pendientes. Cada tarjeta muestra el valor del crédito, el **Saldo pendiente**, las cuotas pagadas y el **Próximo cobro**. Si el borde de la tarjeta es rojo, hay una cuota vencida.",
      },
      { tipo: "subtitulo", texto: "Buscar a un cliente" },
      {
        tipo: "numerada",
        items: [
          "Escribe la **Identificación del cliente** y toca **Buscar**. Aparecen sus créditos, pendientes y ya pagados.",
          "Para volver a la lista completa toca **Ver todos los pendientes**.",
        ],
      },
      { tipo: "parrafo", texto: "La búsqueda en esta pantalla es por identificación. Para buscar por nombre usa **Historial de ventas**." },
      { tipo: "subtitulo", texto: "Registrar un abono" },
      {
        tipo: "numerada",
        items: [
          "En la tarjeta del crédito toca **Abonar**.",
          "Escribe el **Valor del abono**.",
          "Elige el **Medio de pago del abono**: Efectivo, Transferencia o Mixto.",
          "Si quieres, escribe una **Nota**.",
          "Toca **Registrar abono**. El sistema muestra el nuevo saldo.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "El abono se aplica a las cuotas en orden, empezando por la más antigua, y no puede ser mayor que el saldo. Cuando el saldo llega a cero, el crédito pasa de **Pendiente** a **Completado** y aparece en el historial como venta completada.",
      },
      { tipo: "subtitulo", texto: "Ver las cuotas o cambiar una fecha de cobro" },
      {
        tipo: "numerada",
        items: [
          "En la tarjeta del crédito toca **Cuotas y abonos**.",
          "En **Plan de pagos** cada cuota dice si está **Pagada**, **Pendiente** o cuánto lleva abonado.",
          "Para mover un cobro, cambia la **Fecha y hora de cobro** de esa cuota y toca **Guardar fecha**. No se puede cambiar la fecha de una cuota ya pagada.",
          "Más abajo, **Abonos recibidos** muestra cada pago que ha hecho el cliente.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "**Ver factura** abre la factura del crédito con el plan de pagos y el saldo al día, lista para enviársela al cliente como estado de cuenta.",
      },
    ],
  },
  {
    numero: 8,
    titulo: "Historial de ventas",
    roles: VENDEDOR,
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "**Historial de ventas** guarda todas las facturas del local y permite buscarlas por nombre del cliente, identificación o número de factura.",
      },
      {
        tipo: "numerada",
        items: [
          "En el menú toca **Historial de ventas**.",
          "Escribe en **Buscar factura** el nombre, la identificación o el número.",
          "Elige qué ver: **Ventas completadas** (contado y créditos ya pagados), **Créditos pendientes** o **Todas**.",
          "Toca **Ver detalles** para abrir la factura y volver a compartirla.",
          "Si la lista es larga, toca **Ver más facturas** al final.",
        ],
      },
      {
        tipo: "parrafo",
        texto: "Cada factura muestra si fue de **Contado** o **Crédito**, si está **Completada** o cuánto tiene pendiente, y el medio de pago.",
      },
      {
        tipo: "parrafo",
        texto: "Para ver todo lo que le ha comprado un cliente, búscalo por nombre o identificación con el filtro **Todas**.",
      },
    ],
  },
  {
    numero: 9,
    titulo: "Inventario",
    roles: VENDEDOR,
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "En **Inventario** están los perfumes del local con su precio y sus unidades. Las ventas descuentan el stock solas; aquí solo se registra lo que entra y se corrigen diferencias.",
      },
      { tipo: "subtitulo", texto: "Agregar un perfume nuevo" },
      {
        tipo: "numerada",
        items: [
          "Toca **Agregar producto**.",
          "Escribe el **Nombre del producto** y el **Precio de venta**. El **Código** es opcional (sirve el código de barras).",
          "Elige la **Marca**. Si no está en la lista, toca **Agregar marca**, escribe el nombre y toca **Guardar marca**.",
          "Elige el **Tipo**, el **Género**, el **Público** y el **Tamaño** (opciones en la tabla de abajo).",
          "Escribe las **Unidades iniciales**.",
          "En **Avisar cuando queden** escribe desde cuántas unidades quieres el aviso de stock bajo. El sistema propone 3.",
          "Toca **Guardar**.",
        ],
      },
      {
        tipo: "tabla",
        columnas: ["Dato", "Opciones"],
        filas: [
          ["Tipo", "Original, 1.1, Imitación, Versión, Esencia"],
          ["Género", "Hombre, Mujer"],
          ["Público", "Adulto, Infantil (Hombre + Infantil aparece como Niño; Mujer + Infantil, como Niña)"],
          ["Tamaño", "2 oz (60 ml), 2.5 oz (75 ml), 3.4 oz (100 ml), 4 oz (120 ml), 4.2 oz (125 ml)"],
        ],
      },
      { tipo: "subtitulo", texto: "Llegó mercancía" },
      {
        tipo: "numerada",
        items: [
          "Busca el perfume y toca **Agregar unidades**.",
          "Escribe la **Cantidad de unidades** que llegaron.",
          "Si quieres, deja una **Nota** (por ejemplo: «Pedido del proveedor, factura 123»).",
          "Toca **Agregar unidades**.",
        ],
      },
      { tipo: "subtitulo", texto: "Corregir el conteo o registrar un daño" },
      {
        tipo: "numerada",
        items: [
          "Abre el perfume con **Ver detalle** (en computador, **Detalle**) y toca **Ajustar stock**.",
          "Elige **Restar unidades** o **Sumar unidades** y escribe la cantidad.",
          "Escribe el **Motivo del ajuste** (obligatorio; por ejemplo «Frasco roto»).",
          "Toca **Guardar ajuste**.",
        ],
      },
      {
        tipo: "parrafo",
        texto: "Usa **Agregar unidades** para mercancía nueva y **Ajustar stock** solo para correcciones, así el historial del perfume queda claro.",
      },
      { tipo: "subtitulo", texto: "Encontrar un perfume" },
      {
        tipo: "vinetas",
        items: [
          "Las pestañas **Todos**, **Hombre** y **Mujer** filtran por género; dentro de cada una puedes elegir adulto o niño/niña.",
          "**Buscar en el inventario** busca por nombre o código.",
          "**Más filtros** permite filtrar por marca, tipo, tamaño y estado de stock. **Quitar filtros** vuelve a mostrar todo.",
        ],
      },
      { tipo: "subtitulo", texto: "Qué significan los estados" },
      {
        tipo: "tabla",
        columnas: ["Estado", "Significa"],
        filas: [
          ["Disponible", "Hay más unidades que el mínimo de aviso"],
          ["Stock bajo", "Quedan pocas: igual o menos que el mínimo de aviso"],
          ["Agotado", "Cero unidades; no se puede vender"],
        ],
      },
      { tipo: "subtitulo", texto: "Ver el detalle, editar o eliminar" },
      {
        tipo: "parrafo",
        texto:
          "En el detalle de un perfume están sus datos y los **Últimos movimientos** (los 20 más recientes: ingresos, ventas y ajustes). Desde ahí también se puede **Editar** el nombre, precio o clasificación, y **Eliminar producto**.",
      },
      {
        tipo: "parrafo",
        texto: "Eliminar un perfume no daña las facturas anteriores. Cambiarle el precio tampoco: cada factura guarda el precio con el que se vendió.",
      },
    ],
  },
  {
    numero: 10,
    titulo: "Gastos",
    roles: VENDEDOR,
    bloques: [
      {
        tipo: "parrafo",
        texto: "En **Gastos** se anota cada salida de plata del negocio; con eso el sistema calcula la utilidad (lo recibido menos los gastos).",
      },
      { tipo: "subtitulo", texto: "Registrar un gasto" },
      {
        tipo: "numerada",
        items: [
          "En el menú toca **Gastos**.",
          "En **Registrar gasto** elige la **Categoría**.",
          "Escribe el **Valor**.",
          "Elige el **Medio de pago**: Efectivo o Transferencia.",
          "Revisa la **Fecha**. Puede ser de hoy o de días anteriores, nunca futura.",
          "Si quieres, escribe una **Descripción**.",
          "Toca **Registrar gasto**.",
        ],
      },
      { tipo: "subtitulo", texto: "Consultar los gastos" },
      {
        tipo: "parrafo",
        texto:
          "Elige el **Mes**, el **Año** y, si quieres, una **Categoría**. Arriba aparecen el **Total de gastos**, lo **Pagado en efectivo** y lo **Pagado por transferencia**.",
      },
      { tipo: "subtitulo", texto: "Eliminar un gasto" },
      {
        tipo: "parrafo",
        texto:
          "Solo se puede eliminar un gasto que registraste tú y el mismo día en que lo registraste. Al día siguiente el botón **Eliminar** ya no aparece.",
      },
    ],
  },
  {
    numero: 11,
    titulo: "Notificaciones",
    roles: VENDEDOR,
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "**Notificaciones** avisa dos cosas: a quién hay que cobrarle y qué perfumes se están acabando. El número junto a **Notificaciones** en el menú dice cuántos avisos hay y se actualiza cada minuto.",
      },
      {
        tipo: "tabla",
        columnas: ["Aviso", "Significa", "Qué hacer"],
        filas: [
          ["**Vencido**", "La fecha de cobro de una cuota ya pasó", "Toca **Ir a cobrar** y registra el abono cuando el cliente pague"],
          ["**Hoy**", "Hay una cuota para cobrar hoy", "Igual: **Ir a cobrar**"],
          ["**Próximo**", "Hay una cuota en los próximos 3 días", "Avísale al cliente con tiempo"],
          ["**Agotado**", "Un perfume quedó en cero", "Toca **Ir al inventario** y agrega unidades cuando llegue mercancía"],
          ["**Stock bajo**", "A un perfume le quedan pocas unidades", "Pide más antes de que se agote"],
        ],
      },
      {
        tipo: "parrafo",
        texto: "**Ir a cobrar** abre **Créditos y abonos** con ese cliente ya buscado. **Actualizar** vuelve a consultar los avisos en el momento.",
      },
      { tipo: "subtitulo", texto: "Avisos en el celular o el computador" },
      {
        tipo: "parrafo",
        texto:
          "En el menú toca **Activar avisos de cobro** y acepta el permiso. Desde ahí llega un aviso del dispositivo cuando hay cobros para hoy o vencidos.",
      },
      {
        tipo: "parrafo",
        texto:
          "Estos avisos solo llegan mientras la aplicación está abierta. Con la aplicación cerrada no llega nada, así que conviene abrirla cada mañana y revisar **Notificaciones**.",
      },
    ],
  },
  {
    numero: 12,
    titulo: "Reportes y Excel",
    roles: AMBOS,
    bloques: [
      {
        tipo: "parrafo",
        texto: "**Reportes y estadísticas** muestra cómo va el negocio en el año o en un mes, y descarga todo en un archivo de Excel.",
      },
      {
        tipo: "numerada",
        items: [
          "En el menú toca **Reportes y estadísticas**.",
          "Elige el **Año**. Para ver un solo mes, elígelo en **Mes (opcional)**; si lo dejas en **Todo el año**, ves el año completo.",
          "Para el archivo, toca **Descargar Excel del año** o **Descargar Excel de** (el mes elegido).",
        ],
      },
      { tipo: "subtitulo", texto: "Los números principales" },
      {
        tipo: "tabla",
        columnas: ["Indicador", "Qué es"],
        filas: [
          ["Total vendido", "Todo lo facturado en el periodo, contado más crédito"],
          ["Recaudado / Dinero recibido", "La plata que realmente entró: ventas de contado más abonos"],
          ["Recibido en efectivo y en transferencia", "Lo mismo, separado por medio de pago"],
          ["Gastos", "Lo registrado en Gastos en el periodo"],
          ["Utilidad", "Lo recibido menos los gastos. Si sale negativa, los gastos superaron lo recibido"],
          ["Cartera pendiente / Por cobrar hoy", "Lo que deben los clientes en este momento"],
          ["Valor del inventario hoy", "Las unidades que hay, multiplicadas por su precio de venta"],
          ["Unidades vendidas", "Cuántos perfumes salieron en el periodo"],
          ["Perfumes agotados", "Cuántos están en cero ahora"],
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "«Total vendido» y «Recaudado» casi nunca coinciden: una venta a crédito cuenta como vendida el día que se factura, pero la plata entra cuando el cliente abona.",
      },
      { tipo: "subtitulo", texto: "Las gráficas" },
      {
        tipo: "vinetas",
        items: [
          "**Top 10 perfumes más vendidos**, ordenado por unidades o por valor.",
          "**Ventas por Hombre, Niño, Mujer y Niña**, por **tipo**, por **marca** y por **tamaño**.",
          "**Contado y crédito mes a mes**, con una línea que muestra la plata que entró.",
          "**Inventario · hoy**: los perfumes por reponer, con el botón **Agregar unidades** ahí mismo.",
        ],
      },
      {
        tipo: "parrafo",
        texto: "Más abajo, **Detalle mensual** muestra mes por mes contado, créditos, abonos, total vendido, recibido, gastos y utilidad.",
      },
      { tipo: "subtitulo", texto: "Qué trae el Excel" },
      {
        tipo: "tabla",
        columnas: ["Hoja", "Contenido"],
        filas: [
          ["Resumen", "Contado, créditos, abonos, recibido, gastos y utilidad mes a mes"],
          ["Facturas", "Todas las facturas del periodo"],
          ["Productos vendidos", "Unidades y valor vendido por perfume"],
          ["Ventas por categoría", "Vendido por público, tipo, marca y tamaño"],
          ["Abonos", "Cada abono recibido"],
          ["Ventas por vendedor", "Lo que vendió cada vendedor"],
          ["Gastos", "Cada gasto, con categoría y medio de pago"],
          ["Cartera", "Créditos con saldo: valor vencido, días de atraso y próxima cuota"],
          ["Inventario", "Stock y valor del inventario"],
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "Las hojas **Cartera** e **Inventario** muestran la situación del momento en que se descarga el archivo, sin importar el periodo elegido. En Cartera, rojo es más de 30 días de atraso y amarillo es algo vencido; en Inventario, rojo es agotado y amarillo es stock bajo.",
      },
    ],
  },
  {
    numero: 13,
    titulo: "Tareas del administrador",
    roles: ADMIN,
    bloques: [
      { tipo: "parrafo", texto: "La cuenta de administrador organiza el negocio y da acceso a las personas; no registra ventas." },
      { tipo: "subtitulo", texto: "Inicio" },
      {
        tipo: "parrafo",
        texto:
          "Muestra cuántos usuarios están esperando local, cuántos están activos y accesos rápidos a Locales y Reportes. Si alguien creó una cuenta y falta asignarle local, aparece el aviso con el botón **Asignar locales ahora**.",
      },
      { tipo: "subtitulo", texto: "Usuarios" },
      {
        tipo: "parrafo",
        texto: "Busca por nombre, identificación o correo, o filtra por **En espera de local**, **Activos** o **En pausa**.",
      },
      {
        tipo: "tabla",
        columnas: ["Botón", "Para qué sirve"],
        filas: [
          ["**Asignar local** / **Cambiar local**", "Darle un local a la cuenta. Al asignarlo, la persona ya puede entrar"],
          ["**Editar**", "Corregir nombre, identificación, correo o teléfono"],
          ["**Contraseña**", "Ponerle una contraseña nueva (por ejemplo, si la olvidó). Su sesión abierta se cierra"],
          ["**Pausar** / **Reactivar**", "Quitarle o devolverle el acceso sin borrar la cuenta"],
          ["**Eliminar**", "Borrar la cuenta. No se puede deshacer; sus facturas se conservan"],
        ],
      },
      { tipo: "subtitulo", texto: "Locales" },
      {
        tipo: "vinetas",
        items: [
          "**Crear local:** nombre, dirección y teléfono.",
          "**Editar:** cambiar esos datos, desmarcar **Local activo** para que nadie trabaje en él, y manejar las **Marcas** y las **Categorías de gastos** del local.",
          "**Sectores de la ciudad:** agregar, renombrar o quitar los sectores que aparecen al facturar.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "Si un sector o una marca ya se usó en facturas o productos, al quitarlo solo se desactiva: deja de aparecer en las listas, pero el historial no cambia. Se puede volver a activar con **Reactivar**.",
      },
      { tipo: "subtitulo", texto: "Reportes" },
      {
        tipo: "parrafo",
        texto:
          "Funciona como el reporte del vendedor (sección 12), eligiendo primero el **Local**. La opción **Todos los locales (consolidado)** descarga un Excel que compara los locales entre sí y junta toda la cartera. Con un solo local, el reporte por local es suficiente.",
      },
    ],
  },
  {
    numero: 14,
    titulo: "Mi cuenta y tamaño de letra",
    roles: AMBOS,
    bloques: [
      { tipo: "subtitulo", texto: "Cambiar la contraseña" },
      {
        tipo: "numerada",
        items: [
          "En el menú toca **Ajustes** y baja hasta **Cuenta**.",
          "Escribe la **Contraseña actual**.",
          "Escribe la **Nueva contraseña** y repítela. Debe cumplir los requisitos que aparecen en pantalla.",
          "Toca **Guardar nueva contraseña**.",
        ],
      },
      { tipo: "subtitulo", texto: "Agrandar la letra" },
      {
        tipo: "parrafo",
        texto:
          "En el menú toca **Ajustes**. En **Apariencia**, mueve la barra **Tamaño de letra** a **Normal**, **Grande** o **Muy grande**. El tamaño elegido queda guardado en ese dispositivo.",
      },
    ],
  },
  {
    numero: 15,
    titulo: "Problemas frecuentes",
    roles: AMBOS,
    bloques: [
      { tipo: "parrafo", texto: "Casi todos los mensajes del sistema dicen qué falta; esta tabla explica los más comunes y cómo resolverlos." },
      {
        tipo: "tabla",
        columnas: ["Lo que aparece", "Por qué pasa", "Qué hacer"],
        filas: [
          [
            "«La identificación o la contraseña no son correctas»",
            "Algún dato está mal escrito",
            "Revisa el número y la contraseña, con sus mayúsculas. Si la olvidaste, el administrador te pone una nueva en **Usuarios → Contraseña**",
          ],
          [
            "«El administrador aún no te ha asignado un local»",
            "La cuenta de vendedor existe, pero el administrador todavía no le asigna un local",
            "Entra como administrador y asígnale el local",
          ],
          ["«Tu cuenta está en pausa»", "El administrador pausó el acceso", "El administrador la reactiva en **Usuarios → Reactivar**"],
          [
            "«El local asignado a tu cuenta está desactivado»",
            "Se desmarcó **Local activo**",
            "El administrador lo vuelve a marcar en **Locales → Editar**",
          ],
          [
            "«El administrador aún no ha agregado sectores para este local» y el botón de registrar no funciona",
            "El local no tiene sectores",
            "Agrégalos como administrador en **Locales → Sectores de la ciudad**",
          ],
          ["«No hay stock de … No se puede vender»", "El perfume está en cero", "Agrega unidades en **Inventario** y vuelve a facturar"],
          ["«Solo hay N unidades de …»", "Se pidió más cantidad de la que hay", "Baja la cantidad o agrega unidades al inventario"],
          [
            "«El descuento no puede ser mayor que el valor de la factura»",
            "El descuento deja el total en negativo",
            "Corrige el valor del descuento",
          ],
          ["«Hay cuotas con fecha pasada»", "Alguna fecha de cobro ya pasó", "Cambia esa fecha por una futura"],
          [
            "«El teléfono … no es un celular válido. No se puede abrir WhatsApp»",
            "El número guardado no es un celular de 10 dígitos",
            "Usa **Compartir imagen**, y corrige el teléfono en la próxima factura de ese cliente",
          ],
          ["«El abono no puede ser mayor que el saldo»", "Se escribió más de lo que debe el cliente", "Escribe como máximo el saldo pendiente"],
          ["«Ya existe un producto con ese código»", "Otro perfume del local usa ese código", "Cambia el código o déjalo vacío"],
          [
            "«Ya existe una cuenta con esa identificación» o «con ese correo electrónico»",
            "Ese dato ya está en otra cuenta",
            "Usa otro número o correo, o entra con la cuenta que ya existe",
          ],
          ["Pantalla «Sin conexión»", "No hay internet", "Revisa el wifi o los datos y toca reintentar"],
          ["«Tu sesión terminó»", "Por seguridad se cerró la sesión", "Vuelve a entrar con tus datos"],
        ],
      },
      { tipo: "subtitulo", texto: "Cambiaron los datos de un cliente" },
      {
        tipo: "parrafo",
        texto:
          "No hay que hacer nada especial. En su próxima factura escribe la identificación, corrige el teléfono, la dirección o el sector, y al registrar quedan guardados los datos nuevos. Las facturas anteriores conservan los datos de ese momento.",
      },
      { tipo: "subtitulo", texto: "Registré una factura con un error" },
      {
        tipo: "parrafo",
        texto:
          "Hoy el sistema no permite editar ni anular una factura ya registrada, ni borrar un abono. Revisa siempre el resumen antes de tocar **Registrar factura** o **Registrar abono**. Si el error ya quedó, anota el caso y avísale a quien administra el sistema para corregirlo.",
      },
    ],
  },
  {
    numero: 16,
    titulo: "Lo que el sistema todavía no hace",
    roles: AMBOS,
    bloques: [
      { tipo: "parrafo", texto: "Estas funciones no existen en la versión actual; conviene saberlo para no buscarlas." },
      {
        tipo: "vinetas",
        items: [
          "**Editar o anular facturas y abonos.** Una vez registrados, quedan como están.",
          "**Pantalla de clientes.** No hay una lista de clientes para consultar o editar. Los clientes se guardan solos al facturar y se consultan por sus facturas (Historial) o sus créditos.",
          "**Proveedores y costo de compra.** No se registra a quién se le compra ni cuánto costó cada perfume. Por eso la «Utilidad» es lo recibido menos los gastos anotados, no la ganancia por perfume.",
          "**Trabajar sin internet.** Sin conexión no se puede consultar ni registrar.",
          "**Avisos de cobro con la aplicación cerrada.** Solo llegan con la aplicación abierta.",
          "**Recuperar la contraseña por correo.** La del vendedor la cambia el administrador. Para la del administrador hay que acudir a quien instaló el sistema.",
          "**Enviar la imagen de la factura por WhatsApp con un solo botón.** El botón de WhatsApp manda texto; la imagen se envía con **Compartir imagen**.",
          "**Descargarla de Play Store o App Store.** Se instala desde el navegador (sección 1).",
        ],
      },
    ],
  },
];

/** Secciones que ve un rol, con solo los bloques que le corresponden. */
export function seccionesPara(rol: RolManual): SeccionManual[] {
  return MANUAL.filter((s) => s.roles.includes(rol)).map((s) => ({
    ...s,
    bloques: s.bloques.filter((b) => !b.roles || b.roles.includes(rol)),
  }));
}

export interface Tramo {
  texto: string;
  negrita: boolean;
}

/** Separa «texto **negrita** texto» en tramos para dibujarlos sin interpretar HTML. */
export function tramos(texto: string): Tramo[] {
  return texto
    .split("**")
    .map((parte, i) => ({ texto: parte, negrita: i % 2 === 1 }))
    .filter((t) => t.texto !== "");
}

/** Todo el texto visible de una sección (para buscar referencias en las pruebas). */
export function textosDe(seccion: SeccionManual): string[] {
  return seccion.bloques.flatMap((b) => {
    switch (b.tipo) {
      case "parrafo":
      case "subtitulo":
        return [b.texto];
      case "numerada":
      case "vinetas":
        return b.items;
      case "tabla":
        return [...b.columnas, ...b.filas.flat()];
    }
  });
}
