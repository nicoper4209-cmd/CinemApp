export interface Movie {
  id: number;
  title: string;
  synopsis: string;
  duration: number;
  genre: string;
  ageRating: string;
  poster: string;
  alt: string;
  year: string;
  rating: number;
  trailer: string
  status: 'available' | 'upcoming';
  releaseDate?: string | null;
}
