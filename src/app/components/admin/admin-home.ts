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
      </div>

      <h3>Módulos previstos</h3>
      <ul>
        @for (section of sections; track section) {
          @if (section !== 'Películas y cartelera') { <li>{{ section }}</li> }
        }
      </ul>
      <p class="note">Las herramientas se incorporarán por etapas. Por ahora, esta pantalla es solo la entrada al panel.</p>
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
    ul { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px 28px; padding-left: 20px; }
    li { padding: 5px 0; }
    .note { margin-top: 24px; padding: 14px 16px; border-left: 3px solid #b99b65; background: #f7f6f2; font-size: 13px; }
  `],
})
export class AdminHome {
  readonly sections = [
    'Productos Candy',
    'Precios y configuración',
    'Cupones y premios',
    'Reportes y auditoría',
    'Avisos de estreno',
  ];
}
