export interface Showtime {
  id: number;
  movieId: number;
  room: string;
  date: string;
  time: string;
  formatId?: number | null;
  /** Legacy value only; pricing_config is the source for estimates. */
  price?: number | null;
}
