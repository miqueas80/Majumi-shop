# Majumi IA · recomendaciones con modelo externo (opcional)

La interfaz ofrece un asistente de productos. En GitHub Pages usa únicamente recomendaciones locales de demostración; **no es IA generativa real**. En Cloudflare Worker se activa usando la API oficial de xKiro: https://docs.xkiro.com/api/chat-completions/ .

1. Configurá un secreto privado en la cuenta Cloudflare con `npx wrangler secret put XKIRO_API_KEY`.
2. Elegí el ID del modelo mediante `XKIRO_MODEL` en `wrangler.jsonc`; verificá disponibilidad y costo antes de cambiarlo.
3. Desplegá Worker y D1 como indica esta guía; probá `POST /api/assistant` desde la web.
4. Límite de 25 consultas/hora por IP, 350 caracteres de consulta, respuesta máxima 330 tokens y timeout de 10 segundos.
5. Sólo se transmiten al modelo la pregunta del cliente y hasta 50 productos públicos; no datos de cobros ni contraseñas. Las sugerencias no aprueban compras ni pagos.

---

# Majumi Control — tienda + centro administrativo (v1)

## Plataforma avanzada de Majumi Shop (2026)

La implementación prioriza **medidas reales** en vez de mezclar frameworks de forma arbitraria: PWA instalable, service worker **sólo para activos públicos** (jamás API/admin/pagos), CSS con renderizado diferido, imágenes responsive, encabezados CSP para Cloudflare Workers, búsqueda local con sugerencias, control de pagos y stock en D1, CI con Node 22 y tests. La entrada pública conserva compatibilidad con GitHub Pages. Cloudflare Workers es obligatorio para pedidos y pagos reales; GitHub Pages sólo muestra productos ficticios marcados como demostración.

Para nuevas imágenes reales: subir una URL HTTPS desde el panel administrativo después de aplicar `migrations/0002_product_images.sql` usando `npm run db:remote`; el campo viaja de la API a la tienda sin bloquear los productos antiguos. Nunca guardar API keys en GitHub.

### Metas técnicas verificables

- Core Web Vitals a medir en dispositivo real: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. **No están certificados sin auditoría de campo.**
- Control de regresión: `npm test` y GitHub Actions sobre cada push o PR.
- Compatibilidad progresiva: la tienda debe funcionar incluso cuando el service worker o las fuentes externas no estén disponibles.
- Modo offline: únicamente navegación/recursos del escaparate en caché; sin confirmar stock ni registrar ventas sin conexión.

## Vista de tienda — edición visual 2

La portada de Majumi Shop fue rediseñada con un lenguaje visual editorial: hero fotográfico, categorías ilustradas, fichas de producto, búsqueda con tolerancia a errores, ordenamiento, favoritos y carrito. **La versión visible en GitHub Pages es una DEMO**, no un comercio habilitado para comprar: sus ocho productos, fotos y precios son ejemplos explícitamente identificados. No se cobran pagos ni se guardan pedidos de compradores en la demo.

**GitHub Pages:** en Settings → Pages, publicar la rama main desde /(root). El archivo raíz index.html redirige a public/, que contiene todos los recursos con rutas relativas y correctas para el subdirectorio del repositorio. La dirección prevista es https://miqueas80.github.io/Majumi-shop/ . Si todavía no aparece, es necesario activar Pages desde la cuenta propietaria; haber subido los archivos no lo habilita automáticamente.

**Modo producción en Cloudflare Workers:** no se muestran los productos ficticios. Se solicitan los productos reales de D1 en /api/products y los pedidos se validan en /api/orders. Sin conectar D1/Worker no se puede operar una tienda real. El código original de Base44 no está disponible; por eso esta es una reconstrucción visual propia y no una copia idéntica de las pantallas internas.

---

Proyecto **independiente de Base44**, preparado para desplegar en **Cloudflare Workers + D1**. Incluye tienda pública y panel privado conectados a una base de datos compartida. No requiere suscripción a Base44, pero **no importa ni lee automáticamente pedidos o productos de la aplicación original**.

> Estado: código de primera implementación entregado y **7 pruebas automatizadas superadas** con un simulador de la API D1 sobre SQLite de Node 22. No se ha desplegado en tu cuenta Cloudflare ni se han probado cobros reales con Mercado Pago; falta configurar credenciales y ensayar los webhooks en sandbox antes de vender.

## Qué hace

| Área | Implementación |
|---|---|
| Ingreso | Inicio de sesión administrativo con contraseña secreta, cookie HttpOnly/Secure/SameSite=Strict, sesión almacenada por hash y vencimiento a las 8 horas. |
| Pedidos | API pública de compras con validación de cliente, cantidades, disponibilidad y precios **consultados en D1**; nombre del comprador y contacto guardados en la base. |
| Estados | `pending → approved → preparing → ready → completed`, con rechazo o cancelación sujetos a reglas. |
| Aprobación humana | El administrador aprueba explícitamente. Se requiere `payment_status=paid`. No existe aprobación automática por IA. |
| Stock | Reserva al aprobar mediante **trigger transaccional SQLite**; revierte stock al cancelar antes de completar y sin orden de proveedor enviada. |
| Pagos | Manual con nota de comprobación y auditoría; o Checkout Pro de Mercado Pago con API y webhook firmado opcional. |
| Proveedores | Registro de proveedores, asignación en catálogo, creación de borradores agrupados y copia del mensaje de compra; marcado de «enviado» manual. |
| Auditoría | Eventos por pedido, actor, fechas y detalles. |
| Catálogo | Altas y edición desde el panel; el producto se muestra en la tienda pública solamente si está activo. |
| Control | KPIs, búsqueda, filtros, paginación y CSV de la página visible. |

## Estructura

- `src/worker.js`: API y lógica de negocio Cloudflare Worker.
- `src/core.js`: validación, utilidades y firma Mercado Pago.
- `migrations/0001_initial.sql`: esquema D1 con integridad referencial, restricciones y triggers de stock.
- `public/admin.html`, `admin.js`, `admin.css`: panel administrativo responsive.
- `public/index.html`, `store.js`, `store.css`: escaparate conectado a API, carrito y checkout.
- `tests/system.test.mjs`: tests sin servicios externos ni cuentas.

## Arranque en local

Requiere Node 22 o posterior y una cuenta Cloudflare para el despliegue remoto.

1. Extraer ZIP, entrar a `majumi-control/` e instalar dependencias:

   ```bash
   npm install
   ```

2. Crear una base D1 desde la consola (requiere iniciar sesión una vez con `npx wrangler login`):

   ```bash
   npx wrangler d1 create majumi_control
   ```

   Copiar el ID recibido en `wrangler.jsonc`, reemplazando `REEMPLAZAR_CON_ID_D1`.

3. Copiar `.dev.vars.example` a `.dev.vars` y configurar dos claves privadas:

   ```dotenv
   ADMIN_EMAIL=tu-correo@dominio.com
   ADMIN_PASSWORD=una_contraseña_unica_de_al_menos_16_caracteres
   ```

   **No subas `.dev.vars` a GitHub.** El archivo está excluido por `.gitignore`.

4. Inicializar la BD local y levantar la web:

   ```bash
   npm run db:local
   npm run dev
   ```

5. Abrir en el navegador:
   - `http://localhost:8787/admin.html` para **administrar**.
   - `http://localhost:8787/` para la **tienda conectada**.

   En el panel creá primero **un proveedor** y después **un producto** asociado al proveedor. Entonces el cliente lo verá publicado y podrá crear pedidos. No se precargan productos falsos de la tienda original.

6. Ejecutar las pruebas:

   ```bash
   npm test
   ```

   Los tests usan la SQLite integrada en Node 22. Si el sistema los ejecuta correctamente, aparecen **7 pruebas aprobadas**.

## Publicar en Cloudflare

Una vez validada la aplicación con datos de prueba:

```bash
npm run db:remote
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
npm run deploy
```

Al ejecutar `secret put`, la terminal solicita los valores; **no los escribas en archivos públicos**. `wrangler.jsonc` define la carpeta `public/` para los assets, la vinculación `DB` a D1 y el Worker.

Cloudflare asignará una URL tipo `https://majumi-control.<tu-subdominio>.workers.dev`; el nombre real se conoce **después** del despliegue. El proyecto no ha sido publicado desde esta conversación.

**Antes de vender:** HTTPS activo, reglas de privacidad, responsable de cobros autorizado, correos, políticas de cambio, cálculo de entrega, pruebas end-to-end, backups y monitoreo. Los datos de clientes están en D1 y deben protegerse según la normativa aplicable.

## Activar Mercado Pago — integración opcional

Esta funcionalidad es real a nivel de código, pero no se activa hasta completar la configuración del comercio. Se integra Checkout Pro con preferencias creadas en servidor; **jamás se toma el `status=approved` de una redirección como comprobante de pago**.

1. En tu cuenta de desarrollador de Mercado Pago crear una aplicación y obtener credenciales de **prueba**.
2. En Cloudflare registrar **secretos**, sin colocarlos en el cliente:

   ```bash
   npx wrangler secret put MP_ACCESS_TOKEN
   npx wrangler secret put MP_WEBHOOK_SECRET
   ```

3. En `wrangler.jsonc`, cambiar `STORE_PUBLIC_URL` por el dominio HTTPS desplegado, sin la barra final, y si es posible `MP_COLLECTOR_ID` por el ID de vendedor esperado. Volver a desplegar.
4. Configurar el webhook de tipo **`payment`** en Mercado Pago, apuntando a `https://TU-DOMINIO/api/webhooks/mercadopago`, con la misma clave secreta usada en el Worker.
5. Comprobar con usuarios y credenciales de prueba que se genera el checkout, llega el webhook, se valida `x-signature`, y el Worker consulta `/v1/payments/{id}` con el token del comercio. Deben coincidir ID de pedido, importe, moneda `ARS` y vendedor (si se configuró).
6. Verificar resultados pagados, rechazados, pendientes y reembolsados antes de habilitar una cuenta productiva.

**Importante:** el modo Mercado Pago **sólo admite retiro** en esta versión, para evitar cobrar antes de calcular envíos. Para entregas a domicilio el cliente debe coordinar el pago. No se hacen reembolsos automáticos: cancelación de pedido **no** equivale a devolución bancaria. El administrador debe gestionar la devolución en la plataforma de cobros y registrar el incidente.

La firma webhook se valida con HMAC-SHA256 y se limita la antigüedad de la solicitud. Después se solicita el pago a la API oficial y sólo entonces se actualiza el estado en D1.

Referencias técnicas oficiales:
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/d1/
- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/overview
- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/notifications/webhooks

## Recorrido de un pedido

1. El cliente agrega un producto del catálogo central a su carrito, indica datos de contacto y confirma.
2. El Worker **recalcula** los precios y valida cantidades contra la BD. Inserta pedido + artículos + evento de auditoría.
3. Si elige pago coordinado, el administrador confirma manualmente que el dinero fue acreditado, dejando una nota auditable. Si usa Mercado Pago configurado, el servidor espera un webhook firmado y consulta la API.
4. El pedido queda «Listo para aprobar» sólo cuando tiene pago registrado. El administrador pulsa **Aprobar**; se reserva stock atómicamente. Si no alcanza, la aprobación se rechaza sin afectar unidades.
5. El administrador pulsa **Preparar proveedores**. Se genera un borrador por cada proveedor de los artículos vendidos.
6. El administrador pulsa **Copiar orden** y envía el texto por WhatsApp, email u otro canal externo, por su cuenta. Sólo después de hacerlo pulsa **Marcar enviada**.
7. El administrador mueve el pedido por los estados de preparación, listo y completado.

**Esta entrega no envía mensajes a proveedores por sí sola y no tiene integración xKiro activada.** Es deliberado: ninguna IA ni automatización puede aprobar compras, marcar un cobro como acreditado o enviar órdenes en nombre del negocio sin tu control.

## Límites y pasos siguientes

- **Sin importación de Base44:** el negocio original deberá migrarse por capturas/listados, exportación autorizada o carga manual.
- **Sin envíos automáticos:** WhatsApp no es una API gratuita de envíos masivos; la preparación de mensajes es local al panel.
- **Sin facturación/impuestos ni costos de flete:** requiere una siguiente fase antes de vender formalmente con despacho automático.
- **Sin avisos push o Telegram:** posibles, pero requieren credenciales y configuración.
- **Sin asistentes xKiro por ahora:** se puede agregar en una fase posterior sobre esta base. No debe exponerse su clave de API en el navegador.
- **No se han realizado pruebas reales en Cloudflare ni de pago de extremo a extremo.** Las pruebas incluidas ejercitan las rutas Worker con adaptador SQLite local, incluidos webhooks sintéticos de Mercado Pago.
- **Un administrador inicialmente:** el esquema se puede extender a usuarios de equipo y roles.

## Endpoints principales

| Método | Ruta | Protección |
|---|---|---|
| `GET` | `/api/health` | Pública |
| `GET` | `/api/products` | Pública |
| `POST` | `/api/orders` | Origen web igual, validación y límite temporal |
| `POST` | `/api/webhooks/mercadopago?data.id=…` | Firma HMAC + API externa del pago |
| `POST` | `/api/admin/login` | Correo/contraseña + rate limit |
| `POST` | `/api/admin/logout` | Cookie y origen |
| `GET` | `/api/admin/me` | Cookie admin |
| `GET` | `/api/admin/orders?status=&q=&page=` | Cookie admin |
| `GET` | `/api/admin/orders/:id` | Cookie admin |
| `POST` | `/api/admin/orders/:id/status` | Cookie + origen, `{ "action": "approve" }` etc. |
| `POST` | `/api/admin/orders/:id/payment` | Cookie + origen; `{ "note": "..." }`, sólo manual |
| `POST` | `/api/admin/orders/:id/prepare` | Cookie + origen, agrupa compras por proveedor |
| `GET` | `/api/admin/purchase-orders/:id/text` | Cookie admin |
| `POST` | `/api/admin/purchase-orders/:id/sent` | Cookie + origen, registro del envío humano |
| `GET/POST` | `/api/admin/products` | Cookie admin; POST requiere origen |
| `PATCH` | `/api/admin/products/:id` | Cookie + origen |
| `GET/POST` | `/api/admin/suppliers` | Cookie admin; POST requiere origen |

## Seguridad y tratamiento de datos

Se entrega con cookie protegida, consulta parametrizada, hash de tokens de sesión, verificación de origen para mutaciones de navegación, límite temporal en login y pedidos, límite de tamaños, control de cantidades, firma y verificación de pago, eventos de auditoría y bloqueo de transiciones inválidas. Para despliegue comercial conviene añadir sistema de backups, pruebas de recuperación, observabilidad, monitoreo de fraude, políticas de conservación y eliminación de datos, y revisión independiente de seguridad. No consideres el proyecto una solución certificada para pagos sin ese proceso.