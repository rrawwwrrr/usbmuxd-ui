// wda-client.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, timer, throwError } from 'rxjs';
import { catchError, switchMap, retry } from 'rxjs/operators';

export interface DeviceSize {
  width: number;
  height: number;
  scale: number;
}

@Injectable({
  providedIn: 'root'
})
export class WdaClientService {
  private baseUrl: string;
  public sessionId: string | null = null;
  public deviceSize: DeviceSize | null = null;
  public orientation: string | null = null;
  public deviceType: string | null = null;

  constructor(private http: HttpClient) {
    this.baseUrl = 'http://192.168.48.146:8080/api/v1/wda';
  }

  startSession(): Observable<any> {
    const params = { capabilities: {} };
    return this.http.post(`${this.baseUrl}/session`, params)
      .pipe(
        catchError(err => {
          return throwError(() => err);
        })
      );
  }

  stopSession(): Observable<any> {
    if (!this.sessionId) return throwError(() => 'No session');
    return this.http.delete(`${this.baseUrl}/session/${this.sessionId}`);
  }

  getStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}/status`);
  }

  getDeviceSize(): Observable<DeviceSize> {
    return this.http.get<DeviceSize>(`/api/devices/size`);
  }



  swipe(fromX: number, fromY: number, toX: number, toY: number): Observable<any> {
    const actions = {
      actions: [{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: fromX, y: fromY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: 500, x: toX, y: toY },
          { type: 'pointerUp', button: 0 }
        ]
      }]
    };
    return this.http.post(`${this.baseUrl}/session/${this.sessionId}/actions`, actions);
  }

  screenshot(): Observable<any> {
    return this.http.get(`${this.baseUrl}/screenshot`);
  }

  getOrientation(): Observable<any> {
    return this.http.get(`${this.baseUrl}/session/${this.sessionId}/orientation`);
  }

  setOrientation(orientation: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/session/${this.sessionId}/orientation`, { orientation });
  }

  // ...добавляй другие методы по аналогии
}
