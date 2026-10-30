import { Movie } from './movie';
import { Showtime } from './showtime';

export interface Booking {
  id: string;
  movie: Movie;
  showtime: Showtime;
  seats: string[];
  total: number;
  createdAt: string;
  contactEmail?: string;
}
