import { Injectable, signal, computed } from '@angular/core';
import { Device, WsMessage } from '../model/device.model';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HubWsService {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly reconnectDelay = 3000;

  private readonly _devices = signal<Map<string, Device>>(new Map());
  private readonly _connected = signal(false);
  private readonly _lastUpdate = signal<Date | null>(null);

  readonly connected = this._connected.asReadonly();
  readonly lastUpdate = this._lastUpdate.asReadonly();
  readonly deviceList = computed(() => Array.from(this._devices().values()));
  readonly androidCount = computed(() => this.deviceList().filter(d => d.type === 'android').length);
  readonly iosCount = computed(() => this.deviceList().filter(d => d.type === 'ios').length);
  readonly totalCount = computed(() => this.deviceList().length);

  readonly messages$ = new Subject<WsMessage>();

  connect(): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.connectTo(`${proto}://${location.host}/api/v1/devices/ws`);
  }

  private connectTo(url: string): void {
    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this._connected.set(true);
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          this.handleMessage(msg);
          this.messages$.next(msg);
          this._lastUpdate.set(new Date());
        } catch (e) {
          console.error('WS parse error', e);
        }
      };

      this.socket.onclose = () => {
        this._connected.set(false);
        this.scheduleReconnect(url);
      };

      this.socket.onerror = () => {
        this._connected.set(false);
      };
    } catch (e) {
      this.scheduleReconnect(url);
    }
  }

  private scheduleReconnect(url: string): void {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connectTo(url);
      }, this.reconnectDelay);
    }
  }

  private handleMessage(msg: WsMessage): void {
    switch (msg.event) {
      case 'welcome': {
        const devices: Device[] = msg.data?.devices ?? [];
        const map = new Map<string, Device>();
        devices.forEach(d => map.set(d.serial, d));
        this._devices.set(map);
        break;
      }
      case 'ADD':
        if (msg.type === 'DEVICE') {
          this._devices.update(map => {
            const next = new Map(map);
            next.set(msg.device, msg.data as Device);
            return next;
          });
        } else if (msg.type === 'INFO') {
          this._devices.update(map => {
            const device = map.get(msg.device);
            if (!device) return map;
            const next = new Map(map);
            next.set(msg.device, { ...device, Info: { ...device.Info, ...(msg.data ?? {}) } });
            return next;
          });
        }
        break;

      case 'DELETE':
        if (msg.type === 'DEVICE') {
          this._devices.update(map => {
            const next = new Map(map);
            next.delete(msg.device);
            return next;
          });
        } else if (msg.type === 'INFO') {
          this._devices.update(map => {
            const device = map.get(msg.device);
            if (!device) return map;
            const next = new Map(map);
            next.set(msg.device, { ...device, Info: {} });
            return next;
          });
        }
        break;

      case 'UPDATE':
        if (msg.type === 'STATUS') {
          this._devices.update(map => {
            const device = map.get(msg.device);
            if (!device) return map;
            const next = new Map(map);
            next.set(msg.device, {
              ...device,
              disabled: msg.data?.disabled ?? device.disabled,
              Status: msg.data?.Status ?? device.Status,
              StatusMsg: msg.data?.StatusMsg ?? device.StatusMsg,
            });
            return next;
          });
        }
        break;
    }
  }

  updateDeviceDisabled(serial: string, disabled: boolean): void {
    this._devices.update(map => {
      const device = map.get(serial);
      if (!device) return map;
      const next = new Map(map);
      next.set(serial, { ...device, disabled });
      return next;
    });
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }
}
