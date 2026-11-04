import { Injectable } from '@angular/core';
import { AuditLogEntry, DailyBillingReport, MovieSalesRow } from '../models/reports';
import { supabase } from '../supabase.client';

interface DailyReportRow {
  report_date: string;
  bookings_count: number | string;
  tickets_count: number | string;
  tickets_amount: number | string;
  candy_amount: number | string;
  discounts: number | string;
  credit_used: number | string;
  cash_total: number | string;
}

interface MovieSalesRowData {
  sale_date: string;
  movie_id: number;
  title: string;
  tickets: number | string;
  revenue: number | string;
}

interface AuditRow {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: unknown;
  created_at: string;
}

interface ProfileRow {
  id: string;
  email: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminReportsService {
  async getDailyReport(date: string): Promise<DailyBillingReport | null> {
    const { data, error } = await supabase.rpc('daily_billing_report', { p_date: date });
    if (error) throw new Error(error.message);
    const row = (data as DailyReportRow[] | null)?.[0];
    if (!row) return null;
    return {
      reportDate: row.report_date,
      bookingsCount: Number(row.bookings_count),
      ticketsCount: Number(row.tickets_count),
      ticketsAmount: Number(row.tickets_amount),
      candyAmount: Number(row.candy_amount),
      discounts: Number(row.discounts),
      creditUsed: Number(row.credit_used),
      cashTotal: Number(row.cash_total),
    };
  }

  async getMovieSales(from: string, to: string, movieIds: number[] | null = null): Promise<MovieSalesRow[]> {
    const { data, error } = await supabase.rpc('movie_sales_report', {
      p_from: from,
      p_to: to,
      p_movie_ids: movieIds,
    });
    if (error) throw new Error(error.message);
    return ((data ?? []) as MovieSalesRowData[]).map(row => ({
      saleDate: row.sale_date,
      movieId: row.movie_id,
      title: row.title,
      tickets: Number(row.tickets),
      revenue: Number(row.revenue),
    }));
  }

  async getAuditLog(limit = 100): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from('audit_log')
      .select('id,actor_id,action,entity,entity_id,details,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as AuditRow[];
    const actorIds = [...new Set(rows.map(row => row.actor_id).filter((id): id is string => Boolean(id)))];
    const emails = new Map<string, string>();

    if (actorIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id,email')
        .in('id', actorIds);
      if (profilesError) throw new Error(profilesError.message);
      for (const profile of (profiles ?? []) as ProfileRow[]) {
        if (profile.email) emails.set(profile.id, profile.email);
      }
    }

    return rows.map(row => ({
      id: row.id,
      actorId: row.actor_id,
      actorEmail: row.actor_id ? emails.get(row.actor_id) ?? null : null,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      details: row.details,
      createdAt: row.created_at,
    }));
  }
}
