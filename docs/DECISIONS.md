# Decisiones de implementación

Decisiones simples para mantener la solución alineada con la SPEC y explicar sus límites en la defensa.

| Tema | Decisión | Motivo |
|---|---|---|
| Fecha de nacimiento | Se pide al registrarse; si una cuenta OAuth o existente todavía no la tiene, se completa en el perfil. El visitante la declara junto con su email antes de iniciar la compra. | La RPC necesita una fecha para validar restricciones y el visitante no tiene un perfil registrado donde guardarla. |
| Edad del visitante | Se mantiene como autodeclaración en el checkout; al confirmar se crea/reutiliza una sesión anónima y se envía `p_birth_date` a `purchase_tickets`. | Cumple D-03 sin crear un flujo de cuenta adicional. |
| Lógica de compra | Angular solicita la RPC; precios, restricciones, puntos y escritura final quedan en Supabase. | Evita duplicar reglas y respeta la atomicidad definida en la SPEC. |
| PWA y push | Se usa el service worker generado por Angular para caché offline y notificaciones push; se cachea solo el catálogo público. | Evita registrar dos workers con el mismo alcance y no almacena datos privados fuera de línea. |
| Envío push | La Edge Function procesa la cola con la service role, configurada solo en Supabase; un scheduler la invoca periódicamente. | La cola y su procesamiento forman parte de RF-22/RNF-19; no se exponen credenciales privilegiadas al navegador. |
| Datos de configuración | La URL y la clave anon de Supabase son datos públicos del cliente; service role y clave privada VAPID permanecen en el servidor. | Distingue configuración pública de secretos y evita incluir secretos en Angular. |

No se agregan tablas ni columnas: el esquema aplicado y las RPC de la SPEC son la fuente de verdad.
