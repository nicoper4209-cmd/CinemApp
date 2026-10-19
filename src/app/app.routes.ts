import { Routes } from '@angular/router';
import { MovieDetail } from './components/movie-detail/movie-detail';
import { MovieList } from './components/movie-list/movie-list';
import { TopMovies } from './components/top-movies/top-movies';
import { ComingSoon } from './components/coming-soon/coming-soon';
import { Favorites } from './components/favorites/favorites';
import { SeatSelection } from './components/seat-selection/seat-selection';
import { BookingSummary } from './components/booking-summary/booking-summary';

export const routes: Routes = [
    {path:'top',component:TopMovies}, // Top 3 peliculas
    {path:'movies',component:MovieList}, // Cartelera
    {path:'upcoming',component:ComingSoon}, // Proximamente
    {path:'favorites',component:Favorites}, // Mis favoritos
    {path: 'movies/:id',component:MovieDetail}, // Pelicula detalle
    {path: 'seats/:id',component: SeatSelection}, // Butaca detalle
    {path: 'booking-summary',component: BookingSummary}, // Resumen compra
    {path:'',redirectTo:'top',pathMatch:'full'},
    {path:'**',redirectTo:'top'}
];
