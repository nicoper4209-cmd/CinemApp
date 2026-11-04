import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-home',
  imports: [RouterLink],
  template: `
    <section class="admin-home" aria-labelledby="admin-home-title">
      <p class="eyebrow">INICIO</p>
      <h2 id="admin-home-title">Gestión del cine</h2>
      <p class="intro">Este espacio reúne las herramientas administrativas previstas para CinemApp.</p>

      <div class="admin-actions">
        <a routerLink="/admin/movies" class="movies-link">Gestionar películas</a>
        <a routerLink="/admin/showtimes" class="movies-link">Programar funciones</a>
        <a routerLink="/admin/candy" class="movies-link">Administrar Candy</a>
        <a routerLink="/admin/config" class="movies-link">Configurar precios y salas</a>
        <a routerLink="/admin/promotions" class="movies-link">Gestionar cupones y premios</a>
        <a routerLink="/admin/reports" class="movies-link">Ver reportes y auditoría</a>
        <a routerLink="/admin/alerts" class="movies-link">Avisar estrenos</a>
      </div>

      <h3>Estado del panel</h3>
      <p class="note">Los módulos de administración previstos en la SPEC están disponibles. Queda pendiente la verificación integral con datos reales y el despliegue.</p>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .admin-home { max-width: 720px; padding: 28px 0; color: #242424; }
    .eyebrow { margin: 0 0 8px; color: #77736c; font-size: 11px; letter-spacing: .14em; }
    h2 { margin: 0 0 10px; font-size: 24px; }
    .intro, .note { color: #68655f; line-height: 1.6; }
    .admin-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
    .movies-link { display: inline-block; padding: 11px 15px; background: #242424; color: white; font-size: 13px; text-decoration: none; }
    h3 { margin: 28px 0 12px; font-size: 16px; }
    .note { margin-top: 24px; padding: 14px 16px; border-left: 3px solid #b99b65; background: #f7f6f2; font-size: 13px; }
  `],
})
export class AdminHome {
  readonly pendingModules: string[] = [];
}
