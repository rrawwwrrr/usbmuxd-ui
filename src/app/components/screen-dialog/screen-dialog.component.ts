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
  @ViewChild('streamCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly device: Device;

  // State
  readonly loading = signal(true);
  readonly error = signal('');
  readonly connected = signal(false);
  readonly fps = signal(0);

  // Device screen dimensions (actual pixels)
  screenWidth = 0;
  screenHeight = 0;

  // iOS WDA
  wdaSessionId: string | null = null;
  readonly wdaReady = signal(false);

  private ws: WebSocket | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private frameCount = 0;
  private fpsTimer: ReturnType<typeof setInterval> | null = null;
  private dragStart: DragStart | null = null;
  private readonly SWIPE_THRESHOLD = 10; // px on canvas

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ScreenDialogData,
    public dialogRef: MatDialogRef<ScreenDialogComponent>,
    private hubService: HubService,
    private zone: NgZone,
  ) {
    this.device = data.device;
  }

  ngOnInit(): void {
    if (this.device.type === 'ios') {
      this.initWdaSession();
    } else {
      this.loadAndroidScreenSize();
    }
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    this.connectStream();
    this.startFpsCounter();
  }

  ngOnDestroy(): void {
    this.ws?.close();
    if (this.fpsTimer) clearInterval(this.fpsTimer);
    if (this.wdaSessionId && this.device.type === 'ios') {
      this.hubService.deleteWdaSession(this.device.serial, this.wdaSessionId).subscribe();
    }
  }

  // ─── Stream ──────────────────────────────────────────────────────────────

  private connectStream(): void {
    const url = this.hubService.getMjpegWsUrl(this.device.serial);
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'blob';

    this.ws.onopen = () => {
      this.zone.run(() => {
        this.connected.set(true);
        this.loading.set(false);
        this.error.set('');
      });
    };

    this.ws.onmessage = (e: MessageEvent<Blob>) => {
      this.renderFrame(e.data);
    };

    this.ws.onerror = () => {
      this.zone.run(() => {
        this.error.set('Ошибка подключения к стриму');
        this.loading.set(false);
      });
    };

    this.ws.onclose = () => {
      this.zone.run(() => {
        this.connected.set(false);
      });
    };
  }

  private renderFrame(blob: Blob): void {
    createImageBitmap(blob).then(bitmap => {
      const canvas = this.canvasRef?.nativeElement;
      if (!canvas || !this.ctx) return;

      // Auto-detect screen size from first frame
      if (!this.screenWidth || !this.screenHeight) {
        this.screenWidth = bitmap.width;
        this.screenHeight = bitmap.height;
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
      }

      this.ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      this.frameCount++;
    }).catch(() => {});
  }

  private startFpsCounter(): void {
    this.fpsTimer = setInterval(() => {
      this.zone.run(() => this.fps.set(this.frameCount));
      this.frameCount = 0;
    }, 1000);
  }

  // ─── Android screen size ─────────────────────────────────────────────────

  private loadAndroidScreenSize(): void {
    this.hubService.getScreenSize(this.device.serial).subscribe({
      next: (size) => {
        this.screenWidth = size.width;
        this.screenHeight = size.height;
        if (this.canvasRef?.nativeElement) {
          this.canvasRef.nativeElement.width = size.width;
          this.canvasRef.nativeElement.height = size.height;
        }
      },
      error: () => {
        // Not critical - will use frame dimensions
      },
    });
  }

  // ─── iOS WDA session ─────────────────────────────────────────────────────

  private initWdaSession(): void {
    this.hubService.createWdaSession(this.device.serial).subscribe({
      next: (res) => {
        this.wdaSessionId = res?.sessionId ?? res?.value?.sessionId ?? null;
        this.wdaReady.set(!!this.wdaSessionId);
      },
      error: () => {
        // WDA not ready - stream only, no interaction
      },
    });
  }

  // ─── Coordinate mapping ──────────────────────────────────────────────────

  private canvasToDevice(canvasX: number, canvasY: number): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = (this.screenWidth || canvas.width) / rect.width;
    const scaleY = (this.screenHeight || canvas.height) / rect.height;
    return {
      x: Math.round(canvasX * scaleX),
      y: Math.round(canvasY * scaleY),
    };
  }

  // ─── Mouse / Touch events ────────────────────────────────────────────────

  onPointerDown(e: PointerEvent): void {
    e.preventDefault();
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.dragStart = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      time: Date.now(),
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  onPointerUp(e: PointerEvent): void {
    e.preventDefault();
    if (!this.dragStart) return;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    const dx = endX - this.dragStart.x;
    const dy = endY - this.dragStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - this.dragStart.time;

    if (dist < this.SWIPE_THRESHOLD) {
      this.sendTap(this.dragStart.x, this.dragStart.y);
    } else {
      this.sendSwipe(this.dragStart.x, this.dragStart.y, endX, endY, duration);
    }

    this.dragStart = null;
  }

  onPointerCancel(): void {
    this.dragStart = null;
  }

  private sendTap(canvasX: number, canvasY: number): void {
    const { x, y } = this.canvasToDevice(canvasX, canvasY);

    if (this.device.type === 'android') {
      this.hubService.sendAction(this.device.serial, { x1: x, y1: y }).subscribe();
    } else if (this.wdaSessionId) {
      this.hubService.sendWdaTap(this.device.serial, this.wdaSessionId, x, y).subscribe();
    }
  }

  private sendSwipe(cx1: number, cy1: number, cx2: number, cy2: number, durationMs: number): void {
    const start = this.canvasToDevice(cx1, cy1);
    const end = this.canvasToDevice(cx2, cy2);
    const dur = Math.max(200, Math.min(durationMs, 2000));

    if (this.device.type === 'android') {
      this.hubService.sendAction(this.device.serial, {
        x1: start.x, y1: start.y, x2: end.x, y2: end.y, duration: dur,
      }).subscribe();
    } else if (this.wdaSessionId) {
      this.hubService.sendWdaSwipe(
        this.device.serial, this.wdaSessionId,
        start.x, start.y, end.x, end.y, dur,
      ).subscribe();
    }
  }

  // ─── Hardware buttons ────────────────────────────────────────────────────

  pressHome(): void {
    if (this.device.type === 'android') {
      this.hubService.pressHome(this.device.serial).subscribe();
    } else if (this.wdaSessionId) {
      this.hubService.wdaPressHome(this.device.serial, this.wdaSessionId).subscribe();
    }
  }

  pressBack(): void {
    this.hubService.pressBack(this.device.serial).subscribe();
  }

  pressMultitask(): void {
    this.hubService.pressMultitask(this.device.serial).subscribe();
  }

  pressLock(): void {
    this.hubService.pressLock(this.device.serial).subscribe();
  }

  volumeUp(): void {
    this.hubService.volumeUp(this.device.serial).subscribe();
  }

  volumeDown(): void {
    this.hubService.volumeDown(this.device.serial).subscribe();
  }

  get isAndroid(): boolean { return this.device.type === 'android'; }
  get isIos(): boolean { return this.device.type === 'ios'; }
  get canInteract(): boolean {
    return this.connected() && (this.isAndroid || !!this.wdaSessionId);
  }
}
