import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CandyDeliveryResult, StaffService, TicketValidationResult } from '../../services/staff';

type StaffOperation = 'ticket' | 'candy';

@Component({
  selector: 'app-staff',
  imports: [FormsModule],
  templateUrl: './staff.html',
  styleUrl: './staff.css',
})
export class Staff implements OnDestroy {
  private staffService = inject(StaffService);

  @ViewChild('scannerVideo') private scannerVideo?: ElementRef<HTMLVideoElement>;

  operation = signal<StaffOperation>('ticket');
  code = signal('');
  busy = signal(false);
  scannerOpen = signal(false);
  scannerError = signal('');
  errorMessage = signal('');
  ticketResult = signal<TicketValidationResult | null>(null);
  candyResult = signal<CandyDeliveryResult | null>(null);
  private scannerRun = 0;
  private scannerControls: { stop: () => void } | null = null;

  setOperation(operation: StaffOperation): void {
    if (this.operation() === operation) return;
    this.stopScanner();
    this.operation.set(operation);
    this.clearResult();
  }

  async submitCode(value = this.code()): Promise<void> {
    const code = value.trim();
    if (!code || this.busy()) return;

    this.stopScanner();
    this.busy.set(true);
    this.errorMessage.set('');
    this.ticketResult.set(null);
    this.candyResult.set(null);
    this.code.set(code);
    try {
      if (this.operation() === 'ticket') {
        this.ticketResult.set(await this.staffService.validateTicket(code));
      } else {
        this.candyResult.set(await this.staffService.deliverCandy(code));
      }
      this.code.set('');
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'No se pudo procesar el código.'
      );
    } finally {
      this.busy.set(false);
    }
  }

  async startScanner(): Promise<void> {
    if (this.scannerOpen() || this.busy()) return;
    this.scannerError.set('');
    this.errorMessage.set('');
    this.scannerOpen.set(true);
    const run = ++this.scannerRun;

    try {
      const video = this.scannerVideo?.nativeElement;
      if (!video) throw new Error('No se pudo iniciar la vista de la cámara.');

      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      if (run !== this.scannerRun) return;
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(undefined, video, (result, _error, scanControls) => {
        if (run !== this.scannerRun) {
          scanControls.stop();
          return;
        }
        this.scannerControls = scanControls;
        if (!result) return;

        const scannedCode = result.getText().trim();
        this.stopScanner();
        if (scannedCode) void this.submitCode(scannedCode);
      });

      if (run !== this.scannerRun) controls.stop();
      else this.scannerControls = controls;
    } catch (error) {
      if (run !== this.scannerRun) return;
      this.scannerOpen.set(false);
      this.scannerError.set(
        error instanceof Error
          ? `No se pudo abrir la cámara: ${error.message}`
          : 'No se pudo abrir la cámara. Revisá los permisos del navegador e intentá ingresar el código manualmente.'
      );
    }
  }

  stopScanner(): void {
    this.scannerRun++;
    this.scannerControls?.stop();
    this.scannerControls = null;
    this.scannerOpen.set(false);
  }

  clearResult(): void {
    this.errorMessage.set('');
    this.scannerError.set('');
    this.ticketResult.set(null);
    this.candyResult.set(null);
    this.code.set('');
  }

  formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(date);
  }

  seatTypeLabel(seatType: string): string {
    switch (seatType) {
      case 'accessible': return 'Accesible';
      case 'vip': return 'VIP';
      default: return 'Estándar';
    }
  }

  ngOnDestroy(): void {
    this.stopScanner();
  }

  get codeValue(): string { return this.code(); }
  set codeValue(value: string) { this.code.set(value); }
}
