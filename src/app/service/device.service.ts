// device-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, delay, map, of, retryWhen, take } from 'rxjs';
import { DeviceData, WdaStatus } from '../model/device';

@Injectable({ providedIn: 'root' })
export class DeviceApiService {
    private baseUrl = '/api/v1';
    private baseDeviceUrl = '/api/v1/device';
    private baseWdaUrl = '/api/v1/wda';

    constructor(private http: HttpClient) { }

    getDevices(): Observable<DeviceData[]> {
        return this.http.get<DeviceData[]>(`/devices`);
    }

    startWdaSession(udid: string): Observable<any> {
        return this.http.post(`${this.baseDeviceUrl}/${udid}/wda/session`, {});
    }
    stopWdaSession(udid: string): Observable<any> {
        return this.http.delete(`${this.baseDeviceUrl}/${udid}/wda/session`, {});
    }

    getScreenStreamUrl(udid: string): string {
        return `${this.baseDeviceUrl}/${udid}/screenstream`;
    }
    getScreenWdaStreamUrl(udid: string): string {
        return `${this.baseDeviceUrl}/${udid}/wda/stream`;
    }

    installApp(udid: string, file: File): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);

        return this.http.post(
            `${this.baseDeviceUrl}/${udid}/apps/install`,
            formData
        );
    }

    startApp(udid: string, bundleId: string): Observable<any> {
        return this.http.post(
            `${this.baseDeviceUrl}/${udid}/apps/launch?bundleID=${bundleId}`, {}
        );
    }

    stopApp(udid: string, bundleId: string): Observable<any> {
        return this.http.post(
            `${this.baseDeviceUrl}/${udid}/apps/kill?bundleID=${bundleId}`, {}
        );
    }

    deleteApp(udid: string, bundleId: string): Observable<any> {
        return this.http.delete(
            `${this.baseDeviceUrl}/${udid}/apps/uninstall?bundleID=${bundleId}`, {}
        );
    }

    tap(udid: string, sessionId: string, x: number, y: number): Observable<any> {
        console.log(udid)
        const actions = {
            actions: [{
                type: 'pointer',
                id: 'finger1',
                parameters: { pointerType: 'touch' },
                actions: [
                    { type: 'pointerMove', duration: 0, x, y },
                    { type: 'pointerDown', button: 0 },
                    // { "type": "pause", "duration": 500 },
                    { type: 'pointerUp', button: 0 }
                ]
            }]
        };

        return this.http.post(`${this.baseWdaUrl}/${udid}/session/${sessionId}/actions`, actions);
    }

    checkWdaActive(udid: string) {
        return this.http.get(
            `/api/v1/device/${udid}/wda/session`,
            { observe: 'response' }
        ).pipe(
            map(resp => resp.status === 200),
            catchError(err => {
                if (err.status === 404) return of(false);
                // Можно добавить обработку других ошибок
                return of(false);
            })
        );
    }

    getWdaSession(udid: string) {
        this.http.get<WdaStatus>(`/api/v1/wda/${udid}/session`);
    }

    createWdaSession(udid: string) {
        const capabilities = {
            browserName: 'chrome',
            version: 'latest',
            platform: 'MAC'
        };
        console.log("создаем сессию")
        console.log({ capabilities })

        return this.http.post(`/api/v1/wda/${udid}/session`, { capabilities }).pipe(
            retryWhen(errors => errors.pipe(
                delay(1000), // Задержка перед повторной попыткой, например, 1 секунда
                take(3) // Количество попыток, например, 3
            ))
        );
    }

    getWindowSize(udid: string, sessionId: string): Observable<{ width: number, height: number }> {
        return this.http.get<{ value: { width: number, height: number } }>(
            `${this.baseWdaUrl}/${udid}/session/${sessionId}/window/size`
        ).pipe(
            map(resp => resp.value)
        );
    }
}
