# Trazabilidad de requisitos

Estado de referencia del código actual. **Implementado** indica que hay una ruta, componente o servicio asociado; la aceptación final requiere además probarlo contra Supabase y en el navegador.

| Requisito | Implementación principal | Estado / observación |
|---|---|---|
| RF-01, RF-02, RF-15 | `src/app/components/movie-list/`, `movie-detail/`, `top-movies/`, `coming-soon/`; `src/app/services/movie.ts` | Implementado; verificar datos reales y filtros. |
| RF-03, RF-04, RF-25; RN-02, RN-03, RN-07, RN-08 | `src/app/components/seat-selection/`; `src/app/services/seat-hold.ts`; `src/app/utils/seat-validation.ts`; RPC y Realtime del esquema SQL | Implementado en frontend; probar concurrencia con dos sesiones. |
| RF-05; RN-03, RN-04 | `src/app/components/auth/`, `profile/`, `booking-summary/`, `booking-confirmation/`; `src/app/utils/age-rating.ts`; RPC `purchase_tickets` | Registro pide fecha; visitante la declara antes de comprar; OAuth/cuentas incompletas completan perfil. Verificar PDF y restricciones en vivo. |
| RF-06, RF-21 | RPC `schedule_showtimes`; rutas/componentes del proyecto | **Pendiente de verificar** la interfaz administrativa y su cobertura. |
| RF-07 | `src/app/components/booking-confirmation/`; modelos de compra; `jspdf`, `qrcode` | Implementado; validar contenido del QR y PDF. |
| RF-08; HU-03 | `src/app/components/staff/`; `src/app/services/staff.ts`; RPC `validate_ticket`, `deliver_candy` | Implementado; probar escaneo y códigos reales. |
| RF-09, RF-11, RF-28 | `src/app/components/booking-summary/`; `src/app/services/booking.ts`; RPC `purchase_tickets`, `cancel_booking`, `eligible_coupons` | Compra y beneficios conectados; verificar cancelación y cupones según datos configurados. |
| RF-10, RF-26; RNF-20 | `src/app/services/pricing.ts`, `booking.ts`; RPC `purchase_tickets` | Estimación cliente y decisión final en servidor. |
| RF-12, RF-16 | `src/app/components/candy-shop/`; `src/app/services/candy.ts`, `candy-cart.ts`; RPC `purchase_tickets`, `deliver_candy` | Compra de candy; CRUD administrativo pendiente de verificar. |
| RF-13; RF-15 favoritos | `src/app/components/movie-detail/`, `my-movies/`; `src/app/services/favorites.ts`; vistas `movie_reviews`, `movie_ratings` | Implementado; verificar permisos y persistencia. |
| RF-14; RF-09 | `src/app/components/account/`; `src/app/services/account.ts`; RPC de saldo y canje | Implementado; verificar movimientos y reglas con datos reales. |
| RF-17, RF-20; RNF-04, RNF-05, RNF-12 | `src/app/guards/`, `src/app/services/auth.ts`, `src/app/components/auth/`; RLS del esquema SQL | Implementado; los roles se resuelven en base de datos, no desde Angular. |
| RF-18, RF-19; RF-24 | Esquema SQL: reportes, auditoría y `send_premiere_alerts` | **Pendiente de verificar** la interfaz administrativa, exportaciones y gráficos. |
| RF-22, RF-23; RNF-19 | `src/app/services/notifications.ts`, `src/app/components/notification-settings/`, `supabase/functions/send-notifications/`; cola SQL | Suscripción y envío implementados; requiere VAPID, scheduler y prueba desplegada. |
| RF-27; RNF-16, RNF-17, RNF-18 | `ngsw-config.json`, `public/manifest.webmanifest`, `public/icons/`, `src/app/app.config.ts` | Configuración PWA agregada; probar instalación y cartelera offline en build de producción. |
| RN-01 | Trigger y restricciones de `showtimes` en el esquema SQL | Aplicado por la base; probar programación con conflictos. |
| RN-05, RN-06; HU-05 | RPC `cancel_booking`, `redeem_reward`; `src/app/components/account/` | Reglas en RPC; verificar política de crédito y ventana de cancelación. |
| RNF-01, RNF-02, RNF-03 | Componentes standalone, validaciones y bloqueos de butacas | Revisión de accesibilidad, rendimiento y concurrencia pendiente. |
| RNF-06, RNF-07, RNF-08, RNF-09, RNF-10, RNF-11 | Backups/hosting; triggers, RLS, Storage y Realtime del esquema; servicios Angular | Infraestructura y pruebas finales pendientes; documentar backups al desplegar. |
| RNF-13, RNF-14, RNF-15 | Angular 22 standalone, Signals y control flow moderno | Cumplido por estructura y código actuales. |
| RNF-21, RNF-22, RNF-23 | `README.md`, configuración de Angular y Supabase | README presente; deploy y configuración de variables deben verificarse antes de la entrega. |

## Contratos de datos

Las compras y las operaciones de butacas, puntos, créditos y validación se delegan a las RPC. La base y sus migraciones son la fuente de verdad para tablas, políticas y reglas. El frontend muestra estimaciones, no persiste cálculos de compra.
