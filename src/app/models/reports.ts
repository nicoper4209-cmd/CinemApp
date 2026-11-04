export interface DailyBillingReport {
  reportDate: string;
  bookingsCount: number;
  ticketsCount: number;
  ticketsAmount: number;
  candyAmount: number;
  discounts: number;
  creditUsed: number;
  cashTotal: number;
}

export interface MovieSalesRow {
  saleDate: string;
  movieId: number;
  title: string;
  tickets: number;
  revenue: number;
}

export interface MovieSalesTotals {
  movieId: number;
  title: string;
  tickets: number;
  revenue: number;
}

export interface AuditLogEntry {
  id: number;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: unknown;
  createdAt: string;
}
