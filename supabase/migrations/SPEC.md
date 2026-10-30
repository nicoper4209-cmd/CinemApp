# SPEC — CinemApp: sistema web de cine (Programación IV, UTN FRA, División 141)

> Especificación para un agente de código (opencode). Derivada del "Documento de requerimientos V3" (Nicolás Alberto Pérez, entrega 13/10/2026) y del **esquema de base de datos ya definido y aplicado en Supabase** (sección 7).
> Idioma de la UI y del contenido: **español (es-AR)**. Moneda: **ARS ($)**. Zona horaria del negocio: **America/Argentina/Buenos_Aires**.

---

## 0. Instrucciones para el agente

1. Leer esta SPEC completa antes de escribir código.
2. **La base de datos ya existe y es la fuente de verdad** (sección 7). Los archivos `supabase/migrations/20261029_cine_schema.sql` y `supabase/migrations/20261029_cine_hardening.sql` ya fueron ejecutados. **No recrear tablas, no inventar columnas, no renombrar.** Si necesitás un cambio de esquema, crealo como una migración nueva, incremental, y documentala en `docs/DECISIONS.md`.
3. **Toda escritura sobre compras, puntos, créditos, butacas y validaciones se hace exclusivamente llamando a las RPC de la sección 8.** Nunca hacer `insert/update/delete` directos desde Angular sobre esas tablas (están bloqueados por permisos y RLS). Nunca calcular importes, descuentos o puntos en el cliente para persistirlos: el cliente solo los **muestra** (estimación); el servidor es quien decide.
4. Si ya existe código Angular en el repositorio, **inspeccionarlo primero** y adaptarlo (no reescribir desde cero lo que ya funciona). Ajustar los servicios que lean/escriban tablas viejas al esquema de la sección 7.
5. Respetar estrictamente el stack (sección 2). No sustituir tecnologías.
6. Trabajar por fases (sección 12). Al terminar cada fase: la app debe compilar y poder ejecutarse localmente.
7. Cada requerimiento (RF-xx / RNF-xx / RN-xx) debe quedar cubierto. Al finalizar, generar `docs/TRACEABILITY.md` mapeando requerimiento → archivos/migraciones/RPC.
8. Nunca commitear secretos. Variables de entorno + `.env.example`. La `service_role` key **jamás** va en el frontend.
9. Ante ambigüedad, aplicar las decisiones de la sección 10; si no hay decisión, elegir la opción más simple, documentarla en `docs/DECISIONS.md` y continuar.
10. Los mensajes de error de las RPC vienen en español en `error.message`; mostrarlos al usuario tal cual (con estilo de alerta accesible).
11. Commits pequeños y descriptivos, por fase/feature.

---

## 1. Propósito y alcance

Sistema web para un cine (un único edificio) que permite a clientes consultar cartelera, comprar entradas y productos de candy, dejar reseñas y acumular/canjear puntos; a empleados validar entradas y entregar pedidos; y a administradores gestionar películas, salas, funciones, cupones, puntos, reportes y auditoría.

**Fuera de alcance:** mapa del cine; pasarela de pago real (ver D-02).

### Tipos de acceso

| Rol / tipo | Cómo se identifica | Capacidades |
|---|---|---|
| **Visitante (anónimo)** | `supabase.auth.signInAnonymously()` (JWT con claim `is_anonymous = true`) | Ver cartelera, comprar entradas y candy (con autodeclaración de edad y email de contacto). **No**: reseñas, favoritos, "Mis películas", avisos de estreno, cupones, crédito, puntos. |
| **Cliente registrado** | Email+contraseña, Google o GitHub. `profiles.role = 'cliente'` | Todo lo anterior + reseñas, favoritos, "Mis películas", puntos, créditos, cupones, canje, avisos de estreno, push. |
| **Empleado** | `profiles.role = 'empleado'` | Validar entradas (QR o código manual) y entregar pedidos de candy. |
| **Administrador** | `profiles.role = 'admin'` | Gestión completa del catálogo y la configuración, reportes y auditoría. |

> El rol **nunca** se asigna desde Angular. Se promueve desde el SQL Editor / entorno confiable. Un trigger de base impide que un usuario se cambie su propio rol.

---

## 2. Stack tecnológico (obligatorio)

| Área | Tecnología | Req. |
|---|---|---|
| Frontend | **Angular 22**, componentes **standalone** | RNF-13 |
| Estado reactivo | **Angular Signals** donde corresponda | RNF-14 |
| Templates | Control flow moderno `@if`, `@for`, `@switch`, `@defer` (sin `*ngIf`/`*ngFor`, sin NgModules en código nuevo) | RNF-15 |
| Backend | **Supabase** (PostgreSQL, Auth, Realtime, Storage, RPC/Edge Functions) | RNF-09 |
| Auth | Supabase Auth: email+contraseña, **Google**, **GitHub**, **Anonymous Sign-Ins** | RF-20, RNF-04 |
| Seguridad de datos | **RLS** en todas las tablas (ya aplicado) | RNF-04/05/12 |
| Tiempo real | Supabase Realtime sobre `seat_occupancy` | RF-03, RNF-02, RNF-10 |
| Archivos | Supabase Storage (buckets `posters`, `avatars`, `candy`) | RNF-11 |
| PWA | Service Worker (`@angular/pwa`), instalable, cartelera offline | RNF-16/17/18 |
| Push | Web Push + Edge Function que procesa `notification_queue` | RNF-19 |
| Compras | RPC `purchase_tickets` (atómica, PL/pgSQL) | RF-26, RNF-20 |
| Deploy | Hosting compatible (Vercel/Netlify/Cloudflare Pages), URL funcional | RNF-21 |
| Repo | GitHub + `README.md` (instalación, configuración, ejecución) | RNF-22 |
| Config | Variables de entorno; nada sensible en el repo | RNF-23 |

Librerías sugeridas (se pueden usar equivalentes): `@supabase/supabase-js`, `qrcode` (generar QR), `jspdf` o `pdf-lib` (PDF de entrada), `@zxing/browser` o `html5-qrcode` (lector QR), `exceljs`/`xlsx` (Excel), `chart.js`/`ng2-charts` (gráficos). Todo por HTTPS.

Variables de entorno del frontend: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VAPID_PUBLIC_KEY`. Edge Function: `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

---

## 3. Contexto operativo y reglas de sala

### 3.1 Distribución de butacas (igual en todas las salas)
- Filas con letras **A–T** (20 filas), 3 secciones (columnas): 0 = izquierda, 1 = central, 2 = derecha.
- Filas **estándar**: **4 / 20 / 4** butacas por sección (28 por fila).
- Filas **J y K** (accesibles): **2 / 10 / 2** butacas por sección (14 por fila) — RN-07.
- Filas **R, S, T** (VIP): precio superior — RN-08. Misma distribución 4/20/4.
- Salas identificadas con letras (A, B, C, D…) en la tabla `rooms`.

### 3.2 Formato de identificador de butaca (`seat_label`)
`FILA-SECCION-NUMERO`, con la numeración **empezando en 1 dentro de cada sección**:

| Fila | Sección 0 | Sección 1 | Sección 2 | Ejemplo |
|---|---|---|---|---|
| Estándar y VIP | `X-0-1` … `X-0-4` | `X-1-1` … `X-1-20` | `X-2-1` … `X-2-4` | `A-0-1`, `S-1-20` |
| J y K (accesibles) | `X-0-1` … `X-0-2` | `X-1-1` … `X-1-10` | `X-2-1` … `X-2-2` | `J-1-10` |

El layout se genera en el frontend con estas reglas (no hay tabla `seats`). La base valida el formato (`is_valid_seat_label`) y deriva el tipo (`seat_type_of`): J/K → `accessible`, R/S/T → `vip`, resto → `standard`.

### 3.3 Reglas de negocio

| ID | Regla | Dónde se aplica |
|---|---|---|
| RN-01 | Mínimo **30 min** entre fin de una función e inicio de la siguiente en la misma sala. | Constraint de exclusión en `showtimes` (`blocked_until`) |
| RN-02 | La sala se **asigna automáticamente**; nunca dos funciones solapadas. | Trigger `showtimes_before_write` + `assign_room` |
| RN-03 | Menores de 13 no compran +13 ni +18. Menores de 18 no compran +18. | `purchase_tickets` (y validación previa en UI) |
| RN-04 | Toda entrada de películas +13/+18 debe indicar que el menor debe concurrir **acompañado por un adulto**. | PDF de la entrada, pantalla de confirmación y resultado de `validate_ticket.minor_notice` |
| RN-05 | Los puntos **no** son transferibles. | No existe RPC ni UI de transferencia |
| RN-06 | Cancelación hasta **2 h antes** del inicio; el importe pasa a **crédito**. | `cancel_booking` |
| RN-07 | Butacas accesibles = filas J y K (2/10/2). | Layout + `seat_type_of` |
| RN-08 | Butacas VIP = filas R, S, T, precio superior. | `pricing_config` |

---

## 4. Requerimientos funcionales

### Cartelera y contenido
- **RF-01** Home: películas seleccionadas por el admin (`movies.is_featured` / `status`) con info esencial: título, sinopsis, duración, género, clasificación, tráiler, póster.
- **RF-02** Buscador con filtro por género (`movies.genre`).
- **RF-15** Pantallas **Top 3** (vista `top_movies_30d`), **Próximamente** (`status = 'upcoming'`, con botón de avisos → `movie_alerts`) y **Mis películas** (favoritas, próximas funciones y entradas compradas; solo registrados).
- **RF-13** Reseñas con estrellas (1–5) + comentario (solo registrados). Puntuación promedio desde la vista `movie_ratings`.
- **RF-24** El admin configura y envía alertas de estreno (RPC `send_premiere_alerts`).

### Funciones y butacas
- **RF-03** Selección de función y butacas con disponibilidad en tiempo real (suscripción a `seat_occupancy`). Estados visibles: libre, ocupada (`sold`), en proceso de compra (`held`), accesible, VIP.
- **RF-04** Distinguir estándar/accesible/VIP; VIP con precio mayor y **advertencia antes de pagar**.
- **RF-06** Asignación automática de sala respetando 30 min (insertar `showtimes` **sin** `room`; el trigger la asigna).
- **RF-21** Programar funciones con uno o más días de la semana y un horario → RPC `schedule_showtimes`.
- **RF-25** Butacas contiguas si se compra más de una: misma fila, misma sección, números consecutivos (validar en UI y lo exige la RPC).

### Compra
- Flujo: película → función → butacas (bloqueo) → datos → pago → confirmación.
- **RF-05** Restricción por edad (RN-03, RN-04).
- **RF-10** Preventa: los 7 días previos al estreno con precio especial (`pricing_config.presale_price`); luego vuelve al normal automáticamente (lo calcula la RPC con `movies.release_date`).
- **RF-16** Ofertas y combos destacados en la pantalla de compra (`candy_products.is_combo` / `is_featured`).
- **RF-11** Cupón de primera compra (`coupons.type = 'primera_compra'`, 20% inicial, editable por el admin).
- **RF-28** Cupones para mayores de 50 (`coupons.type = 'mayor_50'`, `min_age = 50`, % configurable).
- **RF-09** Cancelación hasta 2 h antes → crédito de cuenta (`credit_ledger`), combinable con otros medios de pago (parámetro `p_use_credit` de `purchase_tickets`).
- **RF-07** PDF con datos de la entrada y **QR** (contenido del QR = `booking_seats.qr_code` en texto) por cada entrada, con aviso de acompañamiento si es +13/+18.
- **RF-26** Compra atómica: `purchase_tickets` (una sola transacción).
- Los visitantes anónimos pueden comprar (D-03).

### Candy
- **RF-12** El admin crea/organiza productos por categoría. Clientes compran solos o junto con entradas. Retiro con **QR/código manual** (`bookings.candy_qr` / `bookings.candy_code`).

### Puntos
- **RF-14** 1 $ = 1 punto. Saldo (`my_points_balance`), movimientos (`points_ledger`), condiciones visibles; canje configurable (`rewards` + `redeem_reward`). Sin transferencias (RN-05).

### Validación y notificaciones
- **RF-08** Validación por QR o código manual (`validate_ticket`, `deliver_candy`).
- **RF-22** Recordatorios 24 h y 2 h antes (la RPC de compra ya encola filas en `notification_queue`; una Edge Function las envía).
- **RF-23** Notificar la validación (la encola `validate_ticket`).

### Administración
- **RF-17** Roles y permisos diferenciados (guards de ruta + RLS).
- **RF-18** Reporte diario (`daily_billing_report`), ventas por película (`movie_sales_report`), exportación PDF y Excel, gráficos.
- **RF-19** Log de actividad (`audit_log`, solo lectura para admin; se llena automáticamente por triggers).
- **RF-20** Login con email+contraseña, Google o GitHub.

### Offline
- **RF-27** Cartelera disponible offline por caché de la PWA.

---

## 5. Requerimientos no funcionales

| ID | Categoría | Requerimiento |
|---|---|---|
| RNF-01 | Usabilidad/Accesibilidad | UI clara, WCAG (contraste, foco visible, labels, navegación por teclado, ARIA), responsive móvil/escritorio. El estado de las butacas se distingue por **color + icono/texto**, no solo color. |
| RNF-02 | Rendimiento | Pantallas principales con carga adecuada (lazy loading, `@defer`, imágenes optimizadas). |
| RNF-03 | Concurrencia | Una butaca no puede venderse dos veces: bloqueo temporal (`seat_holds`, 10 min) + índice único parcial en `booking_seats`. |
| RNF-04 | Seguridad | Supabase Auth (email, Google, GitHub, anónimo), RLS, HTTPS. |
| RNF-05 | Privacidad | Cada usuario accede solo a sus datos. |
| RNF-06 | Disponibilidad | Disponible en horario del cine; backups periódicos (documentar en README). |
| RNF-07 | Auditabilidad | `audit_log` append-only (triggers que bloquean UPDATE/DELETE/TRUNCATE). |
| RNF-08 | Mantenibilidad | Salas, precios, formatos, reglas de puntos, catálogo y parámetros (`app_settings`) editables sin cambiar código. |
| RNF-09/10/11/12 | Persistencia / Realtime / Storage / RLS | Supabase PostgreSQL, Realtime, Storage, RLS por usuario y rol. |
| RNF-13/14/15 | Frontend | Angular 22 standalone, Signals, control flow moderno. |
| RNF-16/17/18 | PWA | Instalable, Service Worker, cartelera offline. |
| RNF-19 | Push | Web Push para recordatorios, validación y estrenos (con permiso). |
| RNF-20 | Transacciones | Compra atómica vía RPC; rollback total ante error. |
| RNF-21/22/23 | Despliegue / Repo / Config | Deploy con URL, GitHub + README, variables de entorno. |

---

## 6. Historias de usuario

**HU-01 Comprar entradas** — Como cliente (registrado o visitante anónimo) quiero elegir película, función y butacas y pagar para obtener mis entradas.
- Visitante: se crea sesión anónima, se pide fecha de nacimiento (autodeclaración) y email de contacto.
- Disponibilidad en tiempo real; butacas contiguas; no se puede comprar una butaca ocupada o bloqueada por otro.
- Cupones válidos (solo registrados); crédito de cuenta combinable con otro medio de pago (solo registrados).
- Se calculan puntos (solo registrados); compra atómica; QR y PDF por entrada.
- RF: RF-03/04/05/07/11/14/25/26/28. RNF: RNF-02/03/04/10/20.

**HU-02 Iniciar sesión** — Email, Google o GitHub; acceso solo a datos propios; se identifica el rol. RF-17/20.

**HU-03 Validar entrada** — Empleado escanea QR o ingresa código manual; la entrada debe existir, estar activa, ser de una función vigente (desde 60 min antes hasta el fin), y no haber sido usada; se registra la validación. RF-08.

**HU-04 Gestionar cartelera** — Admin gestiona películas (destacadas, póster en Storage), programa funciones por días y horario, con sala automática y 30 min de recambio. RF-01/06/21.

**HU-05 Cancelar compra** — Cliente cancela hasta 2 h antes; el importe se convierte en crédito visible y combinable. RF-09.

---

## 7. Esquema de base de datos (YA APLICADO — fuente de verdad)

Todas las tablas tienen RLS activo. Archivos de referencia: `supabase/migrations/20261029_cine_schema.sql` y `20261029_cine_hardening.sql`.

### 7.1 Catálogo y configuración (lectura pública; escritura solo admin)
| Tabla | Columnas clave |
|---|---|
| `movies` | `id` (identity), `title`, `synopsis`, `duration` (min), `genre` (texto, un género), `age_rating` (`'ATP'`,`'+13'`,`'+18'`), `poster` (path en Storage), `alt`, `year`, `release_date`, `rating` (0–10, dato externo/legacy), `trailer`, `status` (`available`,`upcoming`,`unavailable`), `is_featured` |
| `showtimes` | `id` (identity), `movie_id`, `room` (FK `rooms.code`; **omitir al insertar** para asignación automática), `date`, `"time"` (hora local AR; **fuente de verdad al insertar**), `format_id`, `price` (**deprecada**, opcional, ignorar), y calculadas por trigger: `starts_at`, `ends_at`, `blocked_until` (timestamptz) |
| `rooms` | `code` (pk, letra), `active` |
| `formats` | `id`, `name` (2D/3D/4D), `price_multiplier`, `active` |
| `pricing_config` | `seat_type` (`standard`,`accessible`,`vip`), `base_price`, `presale_price` |
| `app_settings` | `key`, `value`, `description` — claves: `hold_minutes`, `presale_days`, `cancel_hours`, `min_gap_minutes`, `points_per_currency`, `top_window_days`, `validation_window_before_min`, `max_seats_per_purchase` |
| `candy_categories` | `id`, `name`, `sort_order`, `active` |
| `candy_products` | `id`, `category_id`, `name`, `description`, `price`, `image_url`, `is_combo`, `is_featured`, `active` |
| `rewards` | `id`, `name`, `description`, `points_cost`, `reward_type` (`credit`,`candy`,`ticket`,`other`), `reward_value`, `active` |

**Precio de una entrada** = `base_price` (o `presale_price` si hay preventa) del tipo de butaca × `formats.price_multiplier`, redondeado a 2 decimales (función `ticket_price`). Mostrar en UI como estimación; el valor definitivo lo fija `purchase_tickets`.

### 7.2 Usuarios
| Tabla | Descripción |
|---|---|
| `profiles` | `id` (= `auth.users.id`), `email`, `full_name`, `birth_date`, `blood_type`, `eye_color`, `vacation_days`, `avatar_url`, `role`. Se crea automáticamente por trigger al registrarse (también para anónimos). El usuario puede editar su perfil **excepto `role`**. `blood_type`, `eye_color` y `vacation_days` son **opcionales** (vienen del documento de requerimientos). Metadatos aceptados en `signUp({ options: { data } })`: `full_name`, `birth_date`, `blood_type`, `eye_color`, `vacation_days`. |
| `favorites` | `(user_id, movie_id)` — solo registrados |
| `movie_alerts` | `(user_id, movie_id)` — avisos de estreno, solo registrados |
| `reviews` | `user_id`, `movie_id`, `stars` 1–5, `comment`; único `(user_id, movie_id)`; lectura pública; escritura solo registrados sobre lo propio |
| `push_subscriptions` | `user_id`, `endpoint`, `p256dh`, `auth` — propias |

### 7.3 Compras (escritura SOLO vía RPC)
| Tabla | Descripción |
|---|---|
| `bookings` | Orden: `id` (uuid), `user_id` (siempre presente; los anónimos tienen `auth.users.id`), `movie_id`, `showtime_id` (**nullable**: compras solo de candy), `subtotal`, `discount`, `coupon_id`, `credit_used`, `total` (monto a cobrar por el medio de pago), `points_earned`, `contact_email`, `payment_method`, `status` (`confirmed`,`cancelled`), `cancelled_at`, `candy_qr` (uuid), `candy_code`, `candy_delivered_at`, `candy_delivered_by`, `created_at` |
| `booking_seats` | **Entradas individuales**: `booking_id`, `showtime_id`, `seat_label`, `seat_type`, `price`, `status` (`active`,`cancelled`), `qr_code` (uuid → contenido del QR), `manual_code` (código manual), `used_at`, `validated_by`. Único parcial `(showtime_id, seat_label)` donde `status='active'` |
| `booking_candy_items` | `booking_id`, `product_id`, `quantity`, `unit_price` |
| `seat_holds` | Bloqueos temporales: `(showtime_id, seat_label)`, `user_id`, `expires_at` — el usuario solo ve los suyos |
| `seat_occupancy` | **Estado público para Realtime**: `(showtime_id, seat_label)`, `state` (`held`/`sold`), `held_until`. Se mantiene por triggers. Una fila `held` con `held_until` vencido se considera libre en la UI |
| `coupons` | `code`, `type` (`primera_compra`,`mayor_50`,`general`), `percentage`, `min_age`, `active`, `valid_from`, `valid_until` — **solo admin** (el cliente usa `eligible_coupons`) |
| `coupon_redemptions`, `reward_redemptions` | Historial de uso (lectura propia) |
| `points_ledger` / `credit_ledger` | Movimientos (`delta`, `reason`, `booking_id`); saldo = suma. Lectura propia |
| `notification_queue` | Notificaciones pendientes/enviadas: `user_id`, `type`, `title`, `body`, `payload`, `send_at`, `sent_at`, `booking_id`. Lectura propia; la escribe la base y la procesa una Edge Function con `service_role` |

### 7.4 Auditoría
`audit_log` (`actor_id`, `action`, `entity`, `entity_id`, `details` jsonb, `created_at`): solo lectura para admin; se llena sola por triggers sobre `movies`, `showtimes`, `rooms`, `formats`, `pricing_config`, `app_settings`, `coupons`, `rewards`, `candy_*` y cambios de rol. Inmutable.

### 7.5 Storage
Buckets públicos de lectura: `posters`, `candy` (escritura solo admin) y `avatars` (cada usuario escribe solo en la carpeta `<su user id>/`). Guardar en la base el **path**/URL pública.

### 7.6 Seguridad (obligatorio respetar)
- El frontend **no** tiene permisos de `insert/update/delete` sobre `bookings`, `booking_seats`, `booking_candy_items`, `points_ledger`, `credit_ledger`, `coupon_redemptions`, `reward_redemptions`, `seat_holds`, `seat_occupancy`, `notification_queue`. No intentarlo.
- Los visitantes anónimos son usuarios reales de `auth.users` con claim `is_anonymous`; las RPC les niegan cupones, crédito y puntos, y las políticas les niegan favoritos, reseñas y avisos. El front debe ocultar esas funciones para anónimos.
- Edge Functions que usen `service_role` viven solo en el servidor.

---

## 8. Contrato de API (RPC, vistas, Realtime)

Llamar con `supabase.rpc('nombre', { parametros })`. Ante error, `error.message` trae el motivo en español.

### 8.1 Compra de entradas

| RPC | Parámetros | Devuelve | Notas |
|---|---|---|---|
| `hold_seats` | `p_showtime_id int`, `p_seats text[]` | `timestamptz` (vencimiento del bloqueo) | Requiere sesión (anónima sirve). Bloquea 10 min; libera las butacas que el usuario ya no seleccionó; falla si otra persona las tiene. Llamar al seleccionar y **renovar** si el usuario sigue en la pantalla |
| `release_seats` | `p_showtime_id int`, `p_seats text[] default null` | — | Libera bloqueos propios (al salir/cancelar) |
| `purchase_tickets` | `p_showtime_id int` (null = solo candy), `p_seats text[]`, `p_candy jsonb` (`[{"product_id":1,"qty":2}]`), `p_coupon_code text`, `p_use_credit numeric`, `p_payment_method text` (`'mock'`), `p_contact_email text` (obligatorio para anónimos), `p_birth_date date` (autodeclaración anónima) | `uuid` (id de `bookings`) | **Atómica**. Valida edad, bloqueos, contigüidad, precios, cupón, crédito; crea reserva, entradas, QR, candy, puntos, recordatorios. Tras el éxito, leer `bookings` + `booking_seats` para armar el PDF |
| `cancel_booking` | `p_booking_id uuid` | `numeric` (crédito acreditado) | Solo hasta 2 h antes; convierte `total + credit_used` en crédito y revierte puntos |

### 8.2 Cuenta del cliente
| RPC | Parámetros | Devuelve |
|---|---|---|
| `my_points_balance` | — | `int` |
| `my_credit_balance` | — | `numeric` |
| `eligible_coupons` | — | filas `(id, code, type, percentage, description)` aplicables al usuario actual (vacío para anónimos). Usar para sugerir/aplicar automáticamente el cupón de primera compra |
| `redeem_reward` | `p_reward_id int` | `jsonb {ok, reward, code}` |

### 8.3 Personal
| RPC | Parámetros | Devuelve |
|---|---|---|
| `validate_ticket` | `p_code text` (UUID del QR **o** código manual) | `jsonb {ok, movie, room, starts_at, seat, seat_type, age_rating, minor_notice}`; error si no existe, cancelada, ya usada, fuera de horario |
| `deliver_candy` | `p_code text` (QR o código manual del pedido) | `jsonb {ok, items:[{name, qty}]}` |

### 8.4 Administración
| RPC / vista | Parámetros | Notas |
|---|---|---|
| `schedule_showtimes` | `p_movie_id int`, `p_from date`, `p_to date`, `p_weekdays int[]` (ISO: 1=lunes…7=domingo), `p_time time`, `p_format_id int default null` | Devuelve `{created, skipped, skipped_dates}`; omite fechas con conflicto |
| `send_premiere_alerts` | `p_movie_id int`, `p_title text`, `p_body text` | Devuelve cantidad de notificaciones encoladas |
| `daily_billing_report` | `p_date date default hoy` | Una fila: reservas, entradas, importe de entradas y candy, descuentos, crédito usado, total cobrado |
| `movie_sales_report` | `p_from date`, `p_to date`, `p_movie_ids int[] default null` | Filas `(sale_date, movie_id, title, tickets, revenue)` para gráficos |

### 8.5 Vistas de lectura
- `movie_ratings` → `(movie_id, avg_stars, review_count)`
- `movie_reviews` → reseñas con `author` (solo primer nombre) e `is_mine`
- `top_movies_30d` → Top 3 por entradas vendidas en la ventana configurada

### 8.6 Realtime de butacas
1. Cargar estado inicial: `from('seat_occupancy').select('seat_label,state,held_until').eq('showtime_id', id)`.
2. Suscribirse a `postgres_changes` (`INSERT`, `UPDATE`, `DELETE`) de `seat_occupancy` filtrando `showtime_id=eq.<id>`.
3. Estados en UI: `sold` → ocupada; `held` no vencida → en proceso de compra (si es **mi** bloqueo, mostrarla como seleccionada); sin fila → libre.
4. Mantener las butacas propias en un `signal` y renovar `hold_seats` mientras dure el flujo.

### 8.7 Notificaciones (Edge Function)
Edge Function programada (cada minuto) con `service_role`: leer `notification_queue` donde `sent_at is null and send_at <= now()`, enviar Web Push a las `push_subscriptions` del `user_id`, y marcar `sent_at = now()`. Eliminar suscripciones que devuelvan 404/410.

---

## 9. Frontend — estructura y pantallas

Arquitectura sugerida (`src/app/`): `core/` (cliente Supabase, auth, guards, interceptors), `shared/` (UI, pipes), `features/` por dominio (`catalog`, `showtimes`, `checkout`, `candy`, `account`, `reviews`, `loyalty`, `staff`, `admin`). Rutas lazy, guards por rol, servicios con Signals (`signal`, `computed`, `effect`).

**Públicas:** home/cartelera, buscador+filtro, detalle de película, Top 3, Próximamente, selección de función/butacas, checkout, candy, login/registro, "continuar como visitante" (autodeclaración de edad + email).
**Registrado:** Mis películas, mis entradas (PDF/QR), reseñas, puntos (saldo, movimientos, canje), crédito, perfil, notificaciones.
**Empleado:** validación (escáner QR + input manual), entrega de candy.
**Admin:** CRUD de películas (con póster), funciones (recurrencia), precios/formatos/salas/parámetros, candy, cupones, premios, reportes (PDF/Excel/gráficos), auditoría, alertas de estreno.

Mapa de butacas: grilla con 3 secciones y filas A–T (ver 3.1/3.2), leyenda, estados por color + icono/texto, actualización por Realtime.
PWA: `ngsw-config.json` con caché de datos de cartelera, manifest e íconos, aviso de modo offline.

---

## 10. Decisiones tomadas

| ID | Tema | Decisión |
|---|---|---|
| D-01 | Mapa del cine | Fuera de alcance. |
| D-02 | Medio de pago | No especificado: `PaymentService` simulado (mock) con interfaz intercambiable; se envía `p_payment_method = 'mock'`. |
| D-03 | Anónimo posiblemente menor | Modal de **autodeclaración de fecha de nacimiento** al continuar como visitante; se envía en `p_birth_date`. Requiere email de contacto. Sesión vía `signInAnonymously()`. |
| D-04 | Precio por formato 2D/3D/4D | `formats.price_multiplier` configurable (defaults 1.0 / 1.25 / 1.5, supuesto). |
| D-05 | Top 3 | Ventana de 30 días (`app_settings.top_window_days`). |
| D-06 | Puntos | Sobre el monto con descuento (incluye lo pagado con crédito). Se reversan al cancelar. |
| D-07 | Anónimos y reseñas / Mis películas / favoritos | No acceden. |
| D-08 | Transferencia de puntos | No permitida. |
| D-09 | Anónimos y puntos/cupones/crédito | No acumulan ni usan. |
| D-10 | Bloqueo de butacas | 10 minutos (`hold_minutes`). |
| D-11 | Cancelación | Crédito = `total + credit_used`; no hay devolución directa. |
| D-12 | Datos de perfil | `blood_type`, `eye_color`, `vacation_days` opcionales (documento de requerimientos), protegidos por RLS. |

---

## 11. Inconsistencias del documento original y resolución

- **HU-01** exigía usuario autenticado pero el alcance permite compra anónima → prevalece el alcance (Anonymous Sign-Ins).
- **HU-01** referenciaba RF-27/RF-28 por error de numeración → se tratan como cupón +50 y cartelera offline.
- **Datos del cliente:** el documento pide "solo lo necesario" pero lista tipo de sangre, color de ojos y días de vacaciones → campos opcionales.
- **Distribución:** "20 filas y 3 columnas" se interpreta como 20 filas × 3 secciones; J/K tienen 2/10/2.

---

## 12. Plan de implementación por fases

> La base de datos (tablas, RLS, RPC, storage, realtime) **ya está lista**. Las fases son de frontend, Edge Functions y despliegue.

1. **Base del proyecto:** Angular 22 standalone + Signals + PWA; cliente Supabase; `.env.example`; README inicial; auditoría del código existente.
2. **Auth y roles:** email, Google, GitHub, visitante anónimo; perfil; guards por rol; modal de autodeclaración de edad.
3. **Catálogo:** home, buscador/filtro, detalle, Top 3, Próximamente, favoritos, reseñas; admin CRUD de películas con póster en Storage.
4. **Funciones:** listado por película/fecha/formato; admin con `schedule_showtimes`.
5. **Butacas y compra:** mapa en tiempo real (`seat_occupancy`), `hold_seats`/`release_seats`, validación de contigüidad en UI, advertencia VIP, cupones, crédito, `purchase_tickets`, PDF + QR.
6. **Candy:** catálogo, carrito, compra junto a entradas o solo candy, QR de retiro.
7. **Puntos, créditos y cancelación:** saldo, movimientos, `redeem_reward`, `cancel_booking`.
8. **Empleado:** `validate_ticket` y `deliver_candy` con lector QR y código manual.
9. **Notificaciones:** permiso push, `push_subscriptions`, Edge Function que procesa `notification_queue`, alertas de estreno (`send_premiere_alerts`).
10. **Admin avanzado:** precios, formatos, salas, `app_settings`, cupones, premios, reportes (PDF/Excel/gráficos), auditoría.
11. **PWA offline y accesibilidad:** caché de cartelera, revisión WCAG.
12. **Despliegue y cierre:** hosting, variables de entorno, README final, `docs/TRACEABILITY.md`, `docs/DECISIONS.md`.

---

## 13. Criterios de aceptación globales

- [ ] Todos los RF/RNF/RN cubiertos en `docs/TRACEABILITY.md`.
- [ ] Ninguna escritura directa del frontend a las tablas de compra/puntos/créditos/butacas; todo por RPC.
- [ ] Una butaca no puede venderse dos veces (probar con dos sesiones simultáneas).
- [ ] Un visitante anónimo puede comprar y recibir su entrada, pero no ve favoritos, reseñas, cupones, puntos ni crédito.
- [ ] La restricción de edad bloquea correctamente +13 y +18 (también para anónimos con autodeclaración).
- [ ] Las entradas +13/+18 muestran el aviso de acompañamiento por un adulto (PDF y confirmación).
- [ ] Cancelación solo hasta 2 h antes y genera crédito visible y combinable.
- [ ] Una entrada ya validada no puede validarse otra vez; QR y código manual funcionan.
- [ ] Un usuario normal no puede cambiar su `role` ni leer datos de otros usuarios ni `audit_log`.
- [ ] La cartelera se ve sin conexión tras una primera carga; la app es instalable.
- [ ] Notificaciones push funcionan (recordatorios 24 h/2 h, validación, estreno) con permiso del usuario.
- [ ] Sin secretos en el repositorio; `.env.example` presente; `service_role` nunca en el frontend.
- [ ] README con instalación, configuración (Supabase, OAuth Google/GitHub, VAPID) y ejecución.
- [ ] Deploy funcional con URL pública.
- [ ] Tests mínimos: edad, preventa, contigüidad, doble validación, cancelación a menos de 2 h, solapamiento de funciones.
