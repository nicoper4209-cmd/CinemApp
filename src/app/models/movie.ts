export interface Movie {
  id: number;
  title: string;
  poster: string;
  alt: string;
  year: string;
  genre: string;
  overview: string;
  rating: number;
  status: 'available' | 'upcoming';
}