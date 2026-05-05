import {
  Component, Inject, OnInit, OnDestroy, ViewChild,
  ElementRef, AfterViewInit, signal, NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Device } from '../../model/device.model';
import { HubService } from '../../service/hub.service';

export interface ScreenDialogData {
  device: Device;
}

interface DragStart {
  x: number;
  y: number;
  time: number;
}

@Component({
  selector: 'app-screen-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './screen-dialog.component.html',
  styleUrl: './screen-dialog.component.scss',
})
export class ScreenDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('streamImg') imgRef!: ElementRef<HTMLImageElement>;
  @ViewChild('overlayCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly device: Device;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly connected = signal(false);
  readonly wdaReady = signal(false);

  deviceWidth = 0;
  deviceHeight = 0;
  streamUrl = '';

  private wdaWs: WebSocket | null = null;
  private wdaReconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private dragStart: DragStart | null = null;
  private readonly SWIPE_THRESHOLD = 10;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ScreenDialogData,
    public dialogRef: MatDialogRef<ScreenDialogComponent>,
    private hubService: HubService,
    private zone: NgZone,
  ) {
    this.device = data.device;
  }

  ngOnInit(): void {
    this.streamUrl = this.hubService.getMjpegUrl(this.device.serial);
    this.connectWdaWs();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    if (this.imgRef?.nativeElement) {
      this.imgRef.nativeElement.src = '';
    }
    this.closeWdaWs();
  }

  onImgLoad(): void {
    this.zone.run(() => {
      this.loading.set(false);
      this.connected.set(true);
      this.error.set('');
    });
  }

  onImgError(): void {
    this.zone.run(() => {
      this.loading.set(false);
      this.connected.set(false);
      this.error.set('Стрим недоступен');
    });
  }

  // ─── WDA WebSocket ───────────────────────────────────────────────────────────

  private connectWdaWs(): void {
    this.hubService.getWsTicket().subscribe({
      next: ({ ticket }) => this.openWdaWs(ticket),
      error: () => this.scheduleWdaReconnect(),
    });
  }

  private openWdaWs(ticket: string): void {
    const url = this.hubService.getWdaWsUrl(this.device.serial, ticket);
    this.wdaWs = new WebSocket(url);

    this.wdaWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'screen_size' && msg.width && msg.height) {
          this.zone.run(() => {
            this.deviceWidth = msg.width;
            this.deviceHeight = msg.height;
            this.wdaReady.set(true);
          });
        }
      } catch {}
    };

    this.wdaWs.onclose = () => {
      this.zone.run(() => this.wdaReady.set(false));
      this.scheduleWdaReconnect();
    };

    this.wdaWs.onerror = () => {
      this.zone.run(() => this.wdaReady.set(false));
    };
  }

  private scheduleWdaReconnect(): void {
    if (this.wdaReconnectTimer || !this.dialogRef) return;
    this.wdaReconnectTimer = setTimeout(() => {
      this.wdaReconnectTimer = null;
      this.connectWdaWs();
    }, 5000);
  }

  private closeWdaWs(): void {
    if (this.wdaReconnectTimer) {
      clearTimeout(this.wdaReconnectTimer);
      this.wdaReconnectTimer = null;
    }
    if (this.wdaWs) {
      this.wdaWs.onclose = null;
      this.wdaWs.close();
      this.wdaWs = null;
    }
    this.wdaReady.set(false);
  }

  // ─── Coordinate mapping ──────────────────────────────────────────────────────

  private imgToDevice(clientX: number, clientY: number): { x: number; y: number } {
    const img = this.imgRef.nativeElement;
    const rect = img.getBoundingClientRect();
    const scaleX = (this.deviceWidth || 1080) / rect.width;
    const scaleY = (this.deviceHeight || 1920) / rect.height;
    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY),
    };
  }

  // ─── Pointer events ───────────────────────────────────────────────────────────

  onPointerDown(e: PointerEvent): void {
    e.preventDefault();
    this.dragStart = { x: e.clientX, y: e.clientY, time: Date.now() };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  onPointerUp(e: PointerEvent): void {
    e.preventDefault();
    if (!this.dragStart) return;

    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - this.dragStart.time;

    if (dist < this.SWIPE_THRESHOLD) {
      this.sendTap(this.dragStart.x, this.dragStart.y);
    } else {
      this.sendSwipe(this.dragStart.x, this.dragStart.y, e.clientX, e.clientY, duration);
    }

    this.dragStart = null;
  }

  onPointerCancel(): void {
    this.dragStart = null;
  }

  private sendTap(clientX: number, clientY: number): void {
    const { x, y } = this.imgToDevice(clientX, clientY);
    if (this.device.type === 'android') {
      this.hubService.sendAction(this.device.serial, { x1: x, y1: y, x2: x, y2: y, duration: 100 }).subscribe();
    } else {
      this.hubService.sendWdaTap(this.device.serial, x, y).subscribe();
    }
  }

  private sendSwipe(cx1: number, cy1: number, cx2: number, cy2: number, durationMs: number): void {
    const start = this.imgToDevice(cx1, cy1);
    const end = this.imgToDevice(cx2, cy2);
    const dur = Math.max(200, Math.min(durationMs, 2000));

    if (this.device.type === 'android') {
      this.hubService.sendAction(this.device.serial, {
        x1: start.x, y1: start.y, x2: end.x, y2: end.y, duration: dur,
      }).subscribe();
    } else {
      this.hubService.sendWdaSwipe(this.device.serial, start.x, start.y, end.x, end.y, dur).subscribe();
    }
  }

  // ─── Hardware buttons ─────────────────────────────────────────────────────────

  pressHome(): void {
    if (this.device.type === 'android') {
      this.hubService.pressHome(this.device.serial).subscribe();
    } else {
      this.hubService.wdaPressHome(this.device.serial).subscribe();
    }
  }

  pressBack(): void { this.hubService.pressBack(this.device.serial).subscribe(); }
  pressMultitask(): void { this.hubService.pressMultitask(this.device.serial).subscribe(); }

  pressLock(): void {
    if (this.device.type === 'android') {
      this.hubService.pressLock(this.device.serial).subscribe();
    } else {
      this.hubService.wdaToggleLock(this.device.serial).subscribe();
    }
  }

  volumeUp(): void {
    if (this.device.type === 'android') {
      this.hubService.volumeUp(this.device.serial).subscribe();
    } else {
      this.hubService.wdaVolumeUp(this.device.serial).subscribe();
    }
  }

  volumeDown(): void {
    if (this.device.type === 'android') {
      this.hubService.volumeDown(this.device.serial).subscribe();
    } else {
      this.hubService.wdaVolumeDown(this.device.serial).subscribe();
    }
  }

  get isAndroid(): boolean { return this.device.type === 'android'; }
  get isIos(): boolean { return this.device.type === 'ios'; }
  get canInteract(): boolean {
    return this.connected() && (this.isAndroid || this.wdaReady());
  }
}
