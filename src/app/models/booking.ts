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

export interface BookingCandyItem {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Booking {
  id: string;
  movie?: Movie | null;
  showtime?: Showtime | null;
  seats: string[];
  total: number;
  createdAt: string;
  contactEmail?: string;
  tickets?: BookingTicket[];
  candyItems?: BookingCandyItem[];
  candyQr?: string;
  candyCode?: string;
  candyQrDataUrl?: string;
}

export interface TicketBooking extends Booking {
  movie: Movie;
  showtime: Showtime;
}
