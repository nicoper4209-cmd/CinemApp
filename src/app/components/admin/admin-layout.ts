import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterOutlet],
  template: `
    <main class="admin-layout">
      <header class="admin-header">
        <div>
          <p class="eyebrow">CINEMAPP / ADMINISTRACIÓN</p>
          <h1>Panel de administración</h1>
        </div>
        <a routerLink="/movies">Volver a la cartelera</a>
      </header>
      <nav class="admin-nav" aria-label="Navegación de administración">
        <a routerLink="/admin">Inicio</a>
        <a routerLink="/admin/movies">Películas</a>
        <a routerLink="/admin/showtimes">Funciones</a>
        <a routerLink="/admin/candy">Candy</a>
        <a routerLink="/admin/config">Configuración</a>
        <a routerLink="/admin/promotions">Cupones y premios</a>
      </nav>
      <router-outlet />
    </main>
  `,
  styles: [`
    :host { display: block; }
    .admin-layout { width: min(100% - 40px, 1080px); margin: 40px auto 72px; }
    .admin-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 24px; border-bottom: 1px solid #dedbd5; }
    .admin-nav { display: flex; gap: 20px; padding: 14px 0; border-bottom: 1px solid #dedbd5; }
    .admin-nav a { color: #555; }
    .eyebrow { margin: 0 0 8px; color: #77736c; font-size: 11px; letter-spacing: .14em; }
    h1 { margin: 0; color: #171717; font-size: clamp(25px, 4vw, 34px); }
    a { color: #333; font-size: 14px; }
    @media (max-width: 600px) { .admin-layout { width: min(100% - 28px, 1080px); margin-top: 24px; } .admin-header { align-items: flex-start; flex-direction: column; } }
  `],
})
export class AdminLayout {}
