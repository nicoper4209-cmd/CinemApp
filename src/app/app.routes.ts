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

export const routes: Routes = [
    {path:'top',component:TopMovies}, // Top 3 peliculas
    {path:'movies',component:MovieList}, // Cartelera
    {path:'upcoming',component:ComingSoon}, // Proximamente
    {path:'movies/:id',component:MovieDetail}, // Pelicula detalle
    {path:'seats/:id',component: SeatSelection}, // Butaca detalle
    {path:'booking-summary',component: BookingSummary}, // Resumen compra
    {path:'booking-confirmation/:id',component: BookingConfirmation}, // Confirmación compra
    {path:'my-movies', component: MyMovies,canActivate: [authGuard]}, // Sección mis peliculas
    {path:'login',component:Auth, canActivate: [guestGuard]}, // Pantalla login
    {path:'register',component:Auth, canActivate: [guestGuard]}, // Pantalla registrarse
    {path:'',redirectTo:'top',pathMatch:'full'},
    {path:'**',redirectTo:'top'}
];
