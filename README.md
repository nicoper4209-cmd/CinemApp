# Cinema

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Notificaciones push

La preferencia se administra desde **Perfil → Notificaciones**. Para habilitar envíos reales:

1. Generá un par de claves VAPID. Configurá la clave **pública** en `vapidPublicKey` de `src/app/environments/environments.ts`; la clave privada no debe estar en el frontend ni en Git.
2. Desplegá la Edge Function `send-notifications` y configurá sus secretos en Supabase:

   ```bash
   supabase secrets set \
     VAPID_PUBLIC_KEY="<clave-publica>" \
     VAPID_PRIVATE_KEY="<clave-privada>" \
     VAPID_SUBJECT="mailto:administracion@tu-dominio.com"
   supabase functions deploy send-notifications
   ```

   `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` deben estar disponibles para la Edge Function desde el entorno Supabase. Nunca copies la service role key al código Angular.
3. Programá una tarea cada minuto que invoque `POST /functions/v1/send-notifications` con `Authorization: Bearer <service-role-key>`. La clave se configura solo en el scheduler; nunca en Angular.
4. El navegador debe usar HTTPS (localhost también sirve durante desarrollo) y el usuario debe aceptar el permiso. La cola sin suscripciones se consume sin envío; endpoints que respondan 404/410 se eliminan. Los errores transitorios quedan pendientes para reintento.

La función usa el service worker de Angular tanto para la PWA como para mostrar avisos push.

## PWA

El service worker y la caché se generan al ejecutar `npm run build` para producción. `ngsw-config.json` cachea los recursos de la aplicación y el catálogo público de películas; no cachea datos privados del usuario. La PWA requiere HTTPS (localhost sirve para desarrollo).

## Documentación del alcance

- [Trazabilidad de requisitos](docs/TRACEABILITY.md)
- [Decisiones de implementación](docs/DECISIONS.md)

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
