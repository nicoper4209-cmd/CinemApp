import { Routes } from '@angular/router';
import { MovieDetail } from './components/movie-detail/movie-detail';
import { MovieList } from './components/movie-list/movie-list';
import { TopMovies } from './components/top-movies/top-movies';
import { ComingSoon } from './components/coming-soon/coming-soon';
import { SeatSelection } from './components/seat-selection/seat-selection';
import { BookingSummary } from './components/booking-summary/booking-summary';
import { BookingConfirmation } from './components/booking-confirmation/booking-confirmation';
import { MyMovies } from './components/my-movies/my-movies';
import { Auth } from './components/auth/auth';
import { authGuard } from './guards/auth-guard';
import { guestGuard } from './guards/guest-guard';
import { CandyShop } from './components/candy-shop/candy-shop';
import { Account } from './components/account/account';
import { Profile } from './components/profile/profile';
import { customerGuard } from './guards/role-guards';
import { AuthCallback } from './components/auth/auth-callback';
import { Staff } from './components/staff/staff';
import { adminGuard, staffGuard } from './guards/role-guards';

export const routes: Routes = [
    {path:'top',component:TopMovies}, // Top 3 peliculas
    {path:'movies',component:MovieList}, // Cartelera
    {path:'upcoming',component:ComingSoon}, // Proximamente
    {path:'candy',component:CandyShop},
    {path:'movies/:id',component:MovieDetail}, // Pelicula detalle
    {path:'seats/:id',component: SeatSelection}, // Butaca detalle
    {path:'booking-summary',component: BookingSummary}, // Resumen compra
    {path:'booking-confirmation/:id',component: BookingConfirmation}, // Confirmación compra
    {path:'my-movies', component: MyMovies,canActivate: [customerGuard]}, // Sección mis peliculas
    {path:'account', component: Account, canActivate: [customerGuard]},
    {path:'profile', component: Profile, canActivate: [authGuard]},
    {path:'login',component:Auth, canActivate: [guestGuard]}, // Pantalla login
    {path:'register',component:Auth, canActivate: [guestGuard]}, // Pantalla registrarse
    {path:'auth/callback', component: AuthCallback},
    {path:'staff', component: Staff, canActivate: [staffGuard]},
    {
      path: 'admin',
      canActivate: [adminGuard],
      loadComponent: () => import('./components/admin/admin-layout').then(module => module.AdminLayout),
      children: [
        {
          path: '',
          loadComponent: () => import('./components/admin/admin-home').then(module => module.AdminHome),
        },
        {
          path: 'movies',
          loadComponent: () => import('./components/admin/movies/admin-movies').then(module => module.AdminMovies),
        },
        {
          path: 'movies/:id/edit',
          loadComponent: () => import('./components/admin/movies/admin-movies').then(module => module.AdminMovies),
        },
        {
          path: 'showtimes',
          loadComponent: () => import('./components/admin/showtimes/admin-showtimes').then(module => module.AdminShowtimes),
        },
        {
          path: 'candy',
          loadComponent: () => import('./components/admin/candy/admin-candy').then(module => module.AdminCandy),
        },
        {
          path: 'config',
          loadComponent: () => import('./components/admin/config/admin-config').then(module => module.AdminConfig),
        },
        {
          path: 'promotions',
          loadComponent: () => import('./components/admin/promotions/admin-promotions').then(module => module.AdminPromotions),
        },
        {
          path: 'reports',
          loadComponent: () => import('./components/admin/reports/admin-reports').then(module => module.AdminReports),
        },
        {
          path: 'alerts',
          loadComponent: () => import('./components/admin/alerts/admin-alerts').then(module => module.AdminAlerts),
        },
      ],
    },
    {path:'',redirectTo:'top',pathMatch:'full'},
    {path:'**',redirectTo:'top'}
];
