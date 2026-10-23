import { Component, inject } from '@angular/core';
import { Router,RouterLink,RouterLinkActive,RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  router = inject(Router);
  private authService = inject(AuthService);

async logout(): Promise<void> {
  try {
    await this.authService.signOut();
    await this.router.navigate(['/']);
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}

}