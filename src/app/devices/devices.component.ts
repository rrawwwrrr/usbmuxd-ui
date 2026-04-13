import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { Device } from '../model/device.model';
import { HubWsService } from '../service/hub-ws.service';
import { HubService } from '../service/hub.service';
import { LogsDialogComponent } from '../components/logs-dialog/logs-dialog.component';
import { ScreenDialogComponent } from '../components/screen-dialog/screen-dialog.component';

type FilterType = 'all' | 'android' | 'ios';

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatMenuModule,
  ],
  templateUrl: './devices.component.html',
  styleUrl: './devices.component.scss',
})
export class DevicesComponent {
  readonly wsService = inject(HubWsService);
  private readonly hubService = inject(HubService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly filter = signal<FilterType>('all');
  readonly search = signal('');
  readonly pendingActions = signal<Set<string>>(new Set());

  readonly filteredDevices = computed(() => {
    const list = this.wsService.deviceList();
    const f = this.filter();
    const s = this.search().toLowerCase().trim();

    return list
      .filter(d => f === 'all' || d.type === f)
      .filter(d =>
        !s ||
        d.serial.toLowerCase().includes(s) ||
        this.getDeviceName(d).toLowerCase().includes(s),
      )
      .sort((a, b) => {
        if (a.disabled !== b.disabled) return a.disabled ? 1 : -1;
        const order: Record<string, number> = { running: 0, starting: 1, stopped: 2, error: 3 };
        return (order[a.Status] ?? 9) - (order[b.Status] ?? 9);
      });
  });

  setFilter(f: FilterType): void {
    this.filter.set(f);
  }

  onSearchChange(value: string): void {
    this.search.set(value);
  }

  getDeviceName(device: Device): string {
    if (device.type === 'android') {
      return device.Info?.model || device.Info?.manufacturer || 'Android Device';
    }
    return device.Info?.DeviceName || device.Info?.ProductType || 'iOS Device';
  }

  getOsVersion(device: Device): string {
    if (device.type === 'android') {
      if (device.Info?.androidVersion) return `Android ${device.Info.androidVersion}`;
      if (device.Info?.sdkVersion) return `SDK ${device.Info.sdkVersion}`;
      return '';
    }
    return device.Info?.HumanReadableProductVersionString ||
      (device.Info?.ProductVersion ? `iOS ${device.Info.ProductVersion}` : '');
  }

  getBatteryLevel(device: Device): number | null {
    const lvl = device.type === 'android'
      ? device.Info?.batteryLevel
      : device.Info?.BatteryCurrentCapacity;
    return lvl != null ? Number(lvl) : null;
  }

  getBatteryTemp(device: Device): number | null {
    const t = device.Info?.batteryTemperature;
    return t != null ? Number(t) : null;
  }

  getBatteryColor(level: number): string {
    if (level >= 60) return '#4caf50';
    if (level >= 20) return '#ff9800';
    return '#f44336';
  }

  getStatusClass(device: Device): string {
    if (device.disabled) return 'status-disabled';
    switch (device.Status) {
      case 'running': return 'status-running';
      case 'starting': return 'status-starting';
      case 'error': return 'status-error';
      case 'stopped': return 'status-stopped';
      default: return 'status-unknown';
    }
  }

  getStatusLabel(device: Device): string {
    if (device.disabled) return 'disabled';
    return device.Status || 'unknown';
  }

  isPending(serial: string): boolean {
    return this.pendingActions().has(serial);
  }

  openLogs(device: Device): void {
    this.dialog.open(LogsDialogComponent, {
      data: { device },
      width: '900px',
      maxWidth: '95vw',
      panelClass: 'dark-dialog',
    });
  }

  openScreen(device: Device): void {
    this.dialog.open(ScreenDialogComponent, {
      data: { device },
      width: '90vw',
      maxWidth: '1100px',
      height: '90vh',
      maxHeight: '900px',
      panelClass: ['dark-dialog', 'screen-dialog'],
    });
  }

  restartContainer(device: Device): void {
    this.setPending(device.serial, true);
    this.hubService.restartContainer(device.serial).subscribe({
      next: () => {
        this.snackBar.open(`Контейнер ${device.serial} перезапускается`, '', { duration: 3000 });
        this.setPending(device.serial, false);
      },
      error: (err) => {
        this.snackBar.open(`Ошибка перезапуска: ${err.statusText || err.message}`, '', { duration: 4000 });
        this.setPending(device.serial, false);
      },
    });
  }

  toggleDisable(device: Device): void {
    const serial = device.serial;
    this.setPending(serial, true);
    const action$ = device.disabled
      ? this.hubService.enableDevice(serial)
      : this.hubService.disableDevice(serial);

    action$.subscribe({
      next: () => {
        const msg = device.disabled ? 'Устройство включено' : 'Устройство отключено';
        this.snackBar.open(msg, '', { duration: 3000 });
        this.wsService.updateDeviceDisabled(serial, !device.disabled);
        this.setPending(serial, false);
      },
      error: (err) => {
        this.snackBar.open(`Ошибка: ${err.statusText || err.message}`, '', { duration: 4000 });
        this.setPending(serial, false);
      },
    });
  }

  private setPending(serial: string, pending: boolean): void {
    this.pendingActions.update(set => {
      const next = new Set(set);
      if (pending) next.add(serial); else next.delete(serial);
      return next;
    });
  }

  trackBySerial(_: number, device: Device): string {
    return device.serial;
  }
}
