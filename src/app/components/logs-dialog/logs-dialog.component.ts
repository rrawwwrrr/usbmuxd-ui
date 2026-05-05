import {
  Component, Inject, OnInit, OnDestroy,
  ViewChild, ElementRef, signal, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Device } from '../../model/device.model';
import { HubService } from '../../service/hub.service';

export interface LogsDialogData {
  device: Device;
}

@Component({
  selector: 'app-logs-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './logs-dialog.component.html',
  styleUrl: './logs-dialog.component.scss',
})
export class LogsDialogComponent implements OnInit, OnDestroy {
  @ViewChild('containerLogsEl') containerLogsEl?: ElementRef<HTMLElement>;
  @ViewChild('deviceLogsEl') deviceLogsEl?: ElementRef<HTMLElement>;

  containerLogs = signal<string[]>([]);
  deviceLogs = signal<string[]>([]);
  containerLogsError = signal('');
  deviceLogsError = signal('');
  autoScroll = signal(true);

  private eventSource: EventSource | null = null;
  private logsWs: WebSocket | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: LogsDialogData,
    public dialogRef: MatDialogRef<LogsDialogComponent>,
    private hubService: HubService,
  ) {
    effect(() => {
      if (this.autoScroll() && this.containerLogs().length > 0) {
        setTimeout(() => this.scrollToBottom(this.containerLogsEl));
      }
    });
    effect(() => {
      if (this.autoScroll() && this.deviceLogs().length > 0) {
        setTimeout(() => this.scrollToBottom(this.deviceLogsEl));
      }
    });
  }

  ngOnInit(): void {
    this.connectContainerLogs();
    this.connectDeviceLogs();
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
    this.logsWs?.close();
  }

  private connectContainerLogs(): void {
    const url = this.hubService.getContainerLogsUrl(this.data.device.serial);
    try {
      this.eventSource = new EventSource(url);
      this.eventSource.onmessage = (e) => {
        this.appendLine(this.containerLogs, e.data);
      };
      this.eventSource.onerror = () => {
        this.containerLogsError.set('Соединение прервано. Переподключение...');
      };
      this.eventSource.onopen = () => {
        this.containerLogsError.set('');
      };
    } catch (e) {
      this.containerLogsError.set('Ошибка подключения к логам контейнера');
    }
  }

  private connectDeviceLogs(): void {
    this.hubService.getWsTicket().subscribe({
      next: ({ ticket }) => this.openDeviceLogsWs(ticket),
      error: () => this.deviceLogsError.set('Ошибка получения тикета'),
    });
  }

  private openDeviceLogsWs(ticket: string): void {
    const url = this.hubService.getDeviceLogsWsUrl(this.data.device.serial, ticket);
    try {
      this.logsWs = new WebSocket(url);
      this.logsWs.onmessage = (e) => {
        this.appendLine(this.deviceLogs, e.data);
      };
      this.logsWs.onerror = () => {
        this.deviceLogsError.set('Ошибка WebSocket соединения');
      };
      this.logsWs.onopen = () => {
        this.deviceLogsError.set('');
      };
      this.logsWs.onclose = () => {
        if (!this.deviceLogsError()) {
          this.deviceLogsError.set('Соединение закрыто');
        }
      };
    } catch (e) {
      this.deviceLogsError.set('Ошибка подключения к логам устройства');
    }
  }

  private appendLine(target: ReturnType<typeof signal<string[]>>, line: string): void {
    target.update(lines => {
      const next = [...lines, line];
      return next.length > 1000 ? next.slice(-1000) : next;
    });
  }

  private scrollToBottom(elRef?: ElementRef<HTMLElement>): void {
    if (elRef?.nativeElement) {
      const el = elRef.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  clearContainerLogs(): void {
    this.containerLogs.set([]);
  }

  clearDeviceLogs(): void {
    this.deviceLogs.set([]);
  }

  toggleAutoScroll(): void {
    this.autoScroll.update(v => !v);
  }
}
