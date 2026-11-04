import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuditLogEntry, DailyBillingReport, MovieSalesRow, MovieSalesTotals } from '../../../models/reports';
import { AdminReportsService } from '../../../services/admin-reports';
import {
  auditActionLabel,
  buildCsv,
  changedAuditFields,
  daysBeforeInArt,
  entityLabel,
  formatReportDate,
  todayInArt,
} from '../../../utils/admin-reports';

@Component({
  selector: 'app-admin-reports',
  imports: [FormsModule],
  templateUrl: './admin-reports.html',
  styleUrl: './admin-reports.css',
})
export class AdminReports {
  private reportsService = inject(AdminReportsService);

  readonly auditLimitOptions = [50, 100, 200];

  reportDate = todayInArt();
  salesFrom = daysBeforeInArt(29);
  salesTo = todayInArt();
  auditLimit = 100;

  daily = signal<DailyBillingReport | null>(null);
  sales = signal<MovieSalesRow[]>([]);
  audit = signal<AuditLogEntry[]>([]);
  dailyLoading = signal(false);
  salesLoading = signal(false);
  auditLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  salesTotals = computed(() => {
    const rows = this.sales();
    return {
      tickets: rows.reduce((sum, row) => sum + row.tickets, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
      days: new Set(rows.map(row => row.saleDate)).size,
    };
  });

  movieTotals = computed<MovieSalesTotals[]>(() => {
    const totals = new Map<number, MovieSalesTotals>();
    for (const row of this.sales()) {
      const current = totals.get(row.movieId) ?? { movieId: row.movieId, title: row.title, tickets: 0, revenue: 0 };
      current.tickets += row.tickets;
      current.revenue += row.revenue;
      totals.set(row.movieId, current);
    }
    return [...totals.values()].sort((a, b) => b.revenue - a.revenue || a.title.localeCompare(b.title, 'es'));
  });

  maxMovieRevenue = computed(() =>
    Math.max(1, ...this.movieTotals().map(row => row.revenue)),
  );

  constructor() {
    void this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.errorMessage.set('');
    const results = await Promise.allSettled([this.loadDaily(), this.loadSales(), this.loadAudit()]);
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) {
      this.errorMessage.set(this.message(failed.reason, 'No se pudieron cargar todos los reportes.'));
    }
  }

  async loadDaily(): Promise<void> {
    if (!this.reportDate) return;
    this.dailyLoading.set(true);
    try {
      this.daily.set(await this.reportsService.getDailyReport(this.reportDate));
    } catch (error) {
      this.daily.set(null);
      throw error;
    } finally {
      this.dailyLoading.set(false);
    }
  }

  async loadSales(): Promise<void> {
    if (!this.salesFrom || !this.salesTo) {
      this.sales.set([]);
      return;
    }
    if (this.salesFrom > this.salesTo) {
      this.sales.set([]);
      throw new Error('La fecha de inicio no puede ser posterior a la de fin.');
    }
    this.salesLoading.set(true);
    try {
      this.sales.set(await this.reportsService.getMovieSales(this.salesFrom, this.salesTo));
    } catch (error) {
      this.sales.set([]);
      throw error;
    } finally {
      this.salesLoading.set(false);
    }
  }

  async loadAudit(): Promise<void> {
    this.auditLoading.set(true);
    try {
      this.audit.set(await this.reportsService.getAuditLog(this.auditLimit));
    } catch (error) {
      this.audit.set([]);
      throw error;
    } finally {
      this.auditLoading.set(false);
    }
  }

  async refreshDaily(): Promise<void> {
    this.clearMessages();
    try {
      await this.loadDaily();
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo consultar la caja del día.'));
    }
  }

  async refreshSales(): Promise<void> {
    this.clearMessages();
    try {
      await this.loadSales();
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo generar el reporte de ventas.'));
    }
  }

  async refreshAudit(): Promise<void> {
    this.clearMessages();
    try {
      await this.loadAudit();
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo cargar el registro de auditoría.'));
    }
  }

  barWidth(revenue: number): number {
    return Math.max(2, Math.round((revenue / this.maxMovieRevenue()) * 100));
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  }

  formatReportDateValue(value: string): string {
    return formatReportDate(value);
  }

  actionLabel(action: string): string {
    return auditActionLabel(action);
  }

  entityLabel(entity: string): string {
    return entityLabel(entity);
  }

  changedFields(entry: AuditLogEntry): string {
    const fields = changedAuditFields(entry.details);
    if (fields.length === 0) return '—';
    const visible = fields.slice(0, 4).join(', ');
    return fields.length > 4 ? `${visible}…` : visible;
  }

  formatAuditDate(value: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(value));
  }

  exportDailyCsv(): void {
    const report = this.daily();
    if (!report) return;
    const csv = buildCsv(
      ['Fecha', 'Reservas', 'Entradas', 'Importe entradas', 'Candy', 'Descuentos', 'Crédito usado', 'Total cobrado'],
      [[
        report.reportDate,
        report.bookingsCount,
        report.ticketsCount,
        report.ticketsAmount.toFixed(2),
        report.candyAmount.toFixed(2),
        report.discounts.toFixed(2),
        report.creditUsed.toFixed(2),
        report.cashTotal.toFixed(2),
      ]],
    );
    this.download(`caja-${report.reportDate}.csv`, csv);
    this.successMessage.set('Caja del día exportada en CSV.');
  }

  exportSalesCsv(): void {
    if (this.sales().length === 0) return;
    const rows: (string | number)[][] = this.sales().map(row => [
      row.saleDate,
      row.title,
      row.tickets,
      row.revenue.toFixed(2),
    ]);
    const csv = buildCsv(['Fecha', 'Película', 'Entradas', 'Ingresos'], rows);
    this.download(`ventas-${this.salesFrom}-a-${this.salesTo}.csv`, csv);
    this.successMessage.set('Reporte de ventas exportado en CSV.');
  }

  async exportDailyPdf(): Promise<void> {
    const report = this.daily();
    if (!report) return;
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.setFontSize(10);
    pdf.text('CINEMAPP · CAJA DEL DÍA', 20, 20);
    pdf.setFontSize(18);
    pdf.text(formatReportDate(report.reportDate), 20, 32);
    const lines = [
      `Reservas confirmadas: ${report.bookingsCount}`,
      `Entradas vendidas: ${report.ticketsCount}`,
      `Importe de entradas: ${this.formatPrice(report.ticketsAmount)}`,
      `Importe de Candy: ${this.formatPrice(report.candyAmount)}`,
      `Descuentos aplicados: ${this.formatPrice(report.discounts)}`,
      `Crédito utilizado: ${this.formatPrice(report.creditUsed)}`,
      `Total cobrado: ${this.formatPrice(report.cashTotal)}`,
    ];
    pdf.setFontSize(12);
    lines.forEach((line, index) => pdf.text(line, 20, 50 + index * 9));
    pdf.save(`caja-${report.reportDate}.pdf`);
    this.successMessage.set('Caja del día exportada en PDF.');
  }

  async exportSalesPdf(): Promise<void> {
    if (this.sales().length === 0) return;
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.setFontSize(10);
    pdf.text('CINEMAPP · VENTAS POR PELÍCULA', 20, 20);
    pdf.setFontSize(16);
    pdf.text(`${formatReportDate(this.salesFrom)} — ${formatReportDate(this.salesTo)}`, 20, 31);
    pdf.setFontSize(11);
    pdf.text(
      `Entradas: ${this.salesTotals().tickets} · Ingresos: ${this.formatPrice(this.salesTotals().revenue)}`,
      20,
      42,
    );

    let y = 54;
    pdf.setFontSize(10);
    for (const row of this.movieTotals()) {
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }
      const title = row.title.length > 60 ? `${row.title.slice(0, 57)}...` : row.title;
      pdf.text(title, 20, y);
      pdf.text(`${row.tickets} entradas`, 140, y);
      pdf.text(this.formatPrice(row.revenue), 170, y);
      y += 7;
    }
    pdf.save(`ventas-${this.salesFrom}-a-${this.salesTo}.pdf`);
    this.successMessage.set('Reporte de ventas exportado en PDF.');
  }

  private download(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  private message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
