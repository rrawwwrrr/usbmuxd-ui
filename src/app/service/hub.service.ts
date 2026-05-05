import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Device } from '../model/device.model';
import { AuthService } from './auth.service';

export interface ScreenSize {
  width: number;
  height: number;
}

export interface AndroidAction {
  x1: number;
  y1: number;
  x2?: number;
  y2?: number;
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class HubService {
  private readonly base = '/api/v1';

  constructor(private http: HttpClient, private auth: AuthService) {}

  // ─── Devices ───────────────────────────────────────────────────────────────

  getDevices(): Observable<Device[]> {
    return this.http.get<Device[]>(`${this.base}/devices`);
  }

  disableDevice(serial: string): Observable<any> {
    return this.http.post(`${this.base}/devices/${serial}/disable`, {});
  }

  enableDevice(serial: string): Observable<any> {
    return this.http.post(`${this.base}/devices/${serial}/enable`, {});
  }

  restartContainer(serial: string): Observable<any> {
    return this.http.get(`${this.base}/devices/restartcontainer/${serial}`);
  }

  // ─── Android controls ──────────────────────────────────────────────────────

  getScreenSize(serial: string): Observable<ScreenSize> {
    return this.http.get<ScreenSize>(`${this.base}/device/${serial}/screen`);
  }

  sendAction(serial: string, action: AndroidAction): Observable<any> {
    return this.http.post(`${this.base}/device/${serial}/action`, action);
  }

  pressHome(serial: string): Observable<any> {
    return this.http.get(`${this.base}/device/${serial}/home`);
  }

  pressBack(serial: string): Observable<any> {
    return this.http.get(`${this.base}/device/${serial}/back`);
  }

  pressMultitask(serial: string): Observable<any> {
    return this.http.get(`${this.base}/device/${serial}/multitask`);
  }

  pressLock(serial: string): Observable<any> {
    return this.http.get(`${this.base}/device/${serial}/lock`);
  }

  volumeUp(serial: string): Observable<any> {
    return this.http.get(`${this.base}/device/${serial}/volume/up`);
  }

  volumeDown(serial: string): Observable<any> {
    return this.http.get(`${this.base}/device/${serial}/volume/down`);
  }

  // ─── iOS WDA ───────────────────────────────────────────────────────────────

  getWsTicket(): Observable<{ ticket: string }> {
    return this.http.get<{ ticket: string }>(`${this.base}/ws-ticket`);
  }

  private wsUrl(path: string, ticket: string): string {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}${path}?ticket=${encodeURIComponent(ticket)}`;
  }

  getWdaWsUrl(serial: string, ticket: string): string {
    return this.wsUrl(`${this.base}/ws/${serial}/session`, ticket);
  }

  sendWdaTap(serial: string, x: number, y: number): Observable<any> {
    const body = {
      actions: [{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x, y },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerUp', button: 0 },
        ],
      }],
    };
    return this.http.post(`${this.base}/device/${serial}/wda/actions`, body);
  }

  sendWdaSwipe(serial: string, x1: number, y1: number, x2: number, y2: number, duration = 500): Observable<any> {
    const body = {
      actions: [{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: x1, y: y1 },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration, x: x2, y: y2 },
          { type: 'pointerUp', button: 0 },
        ],
      }],
    };
    return this.http.post(`${this.base}/device/${serial}/wda/actions`, body);
  }

  wdaPressHome(serial: string): Observable<any> {
    return this.http.post(`${this.base}/device/${serial}/wda/homescreen`, {});
  }

  wdaVolumeUp(serial: string): Observable<any> {
    return this.http.get(`${this.base}/device/${serial}/wda/volumeup`);
  }

  wdaVolumeDown(serial: string): Observable<any> {
    return this.http.get(`${this.base}/device/${serial}/wda/volumedown`);
  }

  wdaToggleLock(serial: string): Observable<any> {
    return this.http.post(`${this.base}/device/${serial}/wda/lock`, {});
  }

  wdaAppSwitcher(serial: string, body: object): Observable<any> {
    return this.http.post(`${this.base}/device/${serial}/wda/appswitcher`, body);
  }

  // ─── Logs & Streams ────────────────────────────────────────────────────────

  getContainerLogsUrl(serial: string, ticket: string): string {
    return `${this.base}/devices/log/${serial}?ticket=${encodeURIComponent(ticket)}`;
  }

  getDeviceLogsWsUrl(serial: string, ticket: string): string {
    return this.wsUrl(`${this.base}/ws/${serial}/logs`, ticket);
  }

  getMjpegUrl(serial: string, ticket: string): string {
    return `${this.base}/device/${serial}/screenstream?ticket=${encodeURIComponent(ticket)}`;
  }

  getMjpegWsUrl(serial: string, ticket: string): string {
    return this.wsUrl(`${this.base}/ws/${serial}/mjpeg`, ticket);
  }
}
