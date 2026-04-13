import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Device } from '../model/device.model';

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

export interface WdaSession {
  sessionId?: string;
  value?: { sessionId?: string; [key: string]: any };
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class HubService {
  private readonly base = '/api/v1';

  constructor(private http: HttpClient) {}

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

  createWdaSession(serial: string): Observable<WdaSession> {
    return this.http.post<WdaSession>(`${this.base}/wda/${serial}/session`, { capabilities: {} });
  }

  deleteWdaSession(serial: string, sessionId: string): Observable<any> {
    return this.http.delete(`${this.base}/wda/${serial}/session/${sessionId}`);
  }

  sendWdaTap(serial: string, sessionId: string, x: number, y: number): Observable<any> {
    const actions = {
      actions: [{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x, y },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerUp', button: 0 },
        ],
      }],
    };
    return this.http.post(`${this.base}/wda/${serial}/session/${sessionId}/actions`, actions);
  }

  sendWdaSwipe(serial: string, sessionId: string,
               x1: number, y1: number, x2: number, y2: number, duration = 500): Observable<any> {
    const actions = {
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
    return this.http.post(`${this.base}/wda/${serial}/session/${sessionId}/actions`, actions);
  }

  wdaPressHome(serial: string, sessionId: string): Observable<any> {
    return this.http.post(
      `${this.base}/wda/${serial}/session/${sessionId}/wda/pressButton`,
      { name: 'home' },
    );
  }

  // ─── Logs & Streams ────────────────────────────────────────────────────────

  getContainerLogsUrl(serial: string): string {
    return `${this.base}/devices/log/${serial}`;
  }

  getDeviceLogsWsUrl(serial: string): string {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}${this.base}/ws/${serial}/logs`;
  }

  getMjpegWsUrl(serial: string): string {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}${this.base}/ws/${serial}/mjpeg`;
  }
}
