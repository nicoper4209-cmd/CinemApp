import { Movie } from './movie';
import { Showtime } from './showtime';

export interface BookingTicket {
  seatLabel: string;
  seatType: 'standard' | 'accessible' | 'vip';
  price: number;
  qrCode: string;
  manualCode: string;
  qrDataUrl?: string;
}

export interface Booking {
  id: string;
  movie: Movie;
  showtime: Showtime;
  seats: string[];
  total: number;
  createdAt: string;
  contactEmail?: string;
  tickets?: BookingTicket[];
}
