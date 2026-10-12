import { Routes } from '@angular/router';
import { MovieDetail } from './components/movie-detail/movie-detail';
import { MovieList } from './components/movie-list/movie-list';
import { TopMovies } from './components/top-movies/top-movies';

export const routes: Routes = [
    {path:'top',component:TopMovies},
    {path:'movies',component:MovieList},
    {path:'movies/:id',component:MovieDetail},
    {path:'',redirectTo:'top',pathMatch:'full'},
    {path:'**',redirectTo:'top'}
];
