import { Movie } from '../models/movie';

export const MOVIES: Movie[] = [
   {
      id: 1,
      title: 'The Wind Rises',
      poster: 'https://image.tmdb.org/t/p/original/a1DKL2yPyxoZthv0du5gcAWA0gw.jpg',
      alt: 'The Wind Rises poster',
      year: '2013',
      genre:'Drama',
      overview: 'Un joven apasionado por la aviación persigue su sueño de diseñar aviones mientras atraviesa los cambios de una época turbulenta.',
      rating: 7.8
    },
    {
      id: 2,
      title: 'Mononoke Hime',
      poster: 'https://image.tmdb.org/t/p/original/xP466sdt19CPLVljpRwI7luEgFn.jpg',
      alt: 'Mononoke Hime poster',
      year: '1997',
      genre:'Adventure',
      overview: 'La historia narra el violento conflicto entre la civilización industrial y los guardianes sobrenaturales de la naturaleza.',
      rating: 8.0
    },
    {
      id: 3,
      title: 'Spirited Away',
      poster: 'https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
      alt: 'Spirited Away poster',
      year: '2001',
      genre:'Fantasy',
      overview: 'Una niña llega a un mundo sobrenatural y debe encontrar la manera de salvar a sus padres y regresar a casa.',
      rating: 8.6
    },
];