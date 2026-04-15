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

  // Device screen dimensions — реальные пиксели устройства (не minicap-фрейм)
  deviceWidth = 0;
  deviceHeight = 0;

  streamUrl = '';

  // iOS WDA
  wdaSessionId: string | null = null;
  readonly wdaReady = signal(false);

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
    if (this.device.type === 'android') {
      this.hubService.getScreenSize(this.device.serial).subscribe({
        next: (s) => { this.deviceWidth = s.width; this.deviceHeight = s.height; },
        error: () => {},
      });
    } else if (this.device.type === 'ios') {
      this.initWdaSession();
    }
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    // Stop stream by clearing src
    if (this.imgRef?.nativeElement) {
      this.imgRef.nativeElement.src = '';
    }
    if (this.wdaSessionId && this.device.type === 'ios') {
      this.hubService.deleteWdaSession(this.device.serial, this.wdaSessionId).subscribe();
    }
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

  // ─── iOS WDA session ─────────────────────────────────────────────────────────

  private initWdaSession(): void {
    this.hubService.createWdaSession(this.device.serial).subscribe({
      next: (res) => {
        this.wdaSessionId = res?.sessionId ?? res?.value?.sessionId ?? null;
        this.wdaReady.set(!!this.wdaSessionId);
        if (this.wdaSessionId) {
          this.hubService.getWdaScreenSize(this.device.serial, this.wdaSessionId).subscribe({
            next: (s) => { this.deviceWidth = s.width; this.deviceHeight = s.height; },
            error: () => {},
          });
        }
      },
      error: () => {},
    });
  }

  // ─── Coordinate mapping ──────────────────────────────────────────────────────

  private imgToDevice(clientX: number, clientY: number): { x: number; y: number } {
    const img = this.imgRef.nativeElement;
    const rect = img.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    // Используем реальное разрешение устройства (не minicap-фрейм, который может быть уменьшен)
    const scaleX = (this.deviceWidth || 1080) / rect.width;
    const scaleY = (this.deviceHeight || 1920) / rect.height;
    return {
      x: Math.round(relX * scaleX),
      y: Math.round(relY * scaleY),
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
    } else if (this.wdaSessionId) {
      this.hubService.sendWdaTap(this.device.serial, this.wdaSessionId, x, y).subscribe();
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
    } else if (this.wdaSessionId) {
      this.hubService.sendWdaSwipe(
        this.device.serial, this.wdaSessionId,
        start.x, start.y, end.x, end.y, dur,
      ).subscribe();
    }
  }

  // ─── Hardware buttons ─────────────────────────────────────────────────────────

  pressHome(): void {
    if (this.device.type === 'android') {
      this.hubService.pressHome(this.device.serial).subscribe();
    } else if (this.wdaSessionId) {
      this.hubService.wdaPressHome(this.device.serial, this.wdaSessionId).subscribe();
    }
  }

  pressBack(): void { this.hubService.pressBack(this.device.serial).subscribe(); }
  pressMultitask(): void { this.hubService.pressMultitask(this.device.serial).subscribe(); }
  pressLock(): void { this.hubService.pressLock(this.device.serial).subscribe(); }
  volumeUp(): void { this.hubService.volumeUp(this.device.serial).subscribe(); }
  volumeDown(): void { this.hubService.volumeDown(this.device.serial).subscribe(); }

  get isAndroid(): boolean { return this.device.type === 'android'; }
  get isIos(): boolean { return this.device.type === 'ios'; }
  get canInteract(): boolean {
    return this.connected() && (this.isAndroid || !!this.wdaSessionId);
  }
}
