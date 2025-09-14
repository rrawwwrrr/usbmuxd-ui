import { AsyncPipe, CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { DeviceData, DeviceSession } from '../model/device';
import { DeviceApiService } from '../service/device.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { FormsModule } from '@angular/forms';
import { WebSocketMessage, WebSocketService } from '../service/websocket.service';

@Component({
    selector: 'app-device-control',
    templateUrl: './devices.component.html',
    styleUrls: ['./devices.component.scss'],
    standalone: true,
    imports: [
        AsyncPipe,
        CommonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconButton,
        MatIconModule,
        FormsModule,
    ]
})
export class DevicesComponent implements OnInit {
    devices: DeviceData[] = [];
    deviceCards: Observable<DeviceData[]>;
    deviceStatus: { [id: string]: boolean } = {};
    sessions: { [id: string]: DeviceSession } = {};
    intervalId: any;
    isConnected = false;
    wsUrl = 'ws://ios.rrawww.ru/ws';
    actions = [
        { value: 'install', label: 'Установить' },
        { value: 'start', label: 'Запустить' },
        { value: 'stop', label: 'Остановить' },
        { value: 'delete', label: 'Удалить' }
    ];
    selectedAction = 'install';
    fileName = '';
    bundleId = '';
    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    constructor(private deviceApiService: DeviceApiService, private webSocketService: WebSocketService) {
        // this.sessions['00008030-001454190EEB802E'] = {
        //     id: "5C2CF09F-269A-42E9-AFE8-E35BB72DD4AC",
        //     width: 375,
        //     height: 667,
        // }
        this.deviceCards = this.deviceApiService.getDevices()
            .pipe(
                map(devices => {
                    this.devices = devices;
                    return devices;
                }))

        const messageSub = this.webSocketService.messages$.subscribe(
            (message: WebSocketMessage) => {
                console.log('Received message:', message);
            }
        );
        this.connect();
    }


    ngOnInit() {
        // this.updateAllWdaStatuses();
        // this.intervalId = setInterval(() => {
        //     console.log(this.deviceStatus)
        //     this.updateAllWdaStatuses();
        // }, 5000);
    }

    ngOnDestroy() {
        clearInterval(this.intervalId);
    }
    // onTap() {
    //     // Пример: тап по центру экрана
    //     this.wda.tap(100, 200).subscribe({
    //         next: res => console.log('Tapped!', res),
    //         error: err => console.error('Tap error', err)
    //     });
    // }

    // onSwipe() {
    //     this.wda.swipe(50, 50, 200, 200).subscribe({
    //         next: res => console.log('Swiped!', res),
    //         error: err => console.error('Swipe error', err)
    //     });
    // }

    // onScreenshot() {
    //     this.wda.screenshot().subscribe({
    //         next: res => console.log('Screenshot:', res),
    //         error: err => console.error('Screenshot error', err)
    //     });
    // }

    startWda(udid: string): void {
        console.log('Запуск WDA для устройства:', udid);
        this.deviceApiService.startWdaSession(udid).subscribe({
            next: res => {
                this.createSession(udid).subscribe();
                this.deviceStatus[udid] = true
            },
            error: err => {
                console.error('Ошибка запуска WDA :', err);
            }
        }
        )
    }
    stopWda(udid: string): void {
        console.log('Запуск WDA для устройства:', udid);
        this.deviceApiService.stopWdaSession(udid).subscribe(
            () => this.deviceStatus[udid] = false
        )
    }

    getStreamUrl(device: DeviceData) {
        const udid = device.Info.UniqueDeviceID;
        return this.checkWdaFromDevice(device)
            ? this.deviceApiService.getScreenWdaStreamUrl(udid)
            : this.deviceApiService.getScreenStreamUrl(udid);
    }

    createSession(udid: string) {
        return this.deviceApiService.createWdaSession(udid).
            pipe(tap(
                res => {
                    console.log('Сессия создана:', res);
                    this.sessions[udid] = { id: res as string, width: 0, height: 0 }
                }
            ));
    }

    updateWdaStatus(deviceId: string) {
        this.deviceApiService.checkWdaActive(deviceId).subscribe(isActive => {
            this.deviceStatus[deviceId] = isActive;
        });
    }

    updateAllWdaStatuses() {
        this.deviceApiService.getDevices().subscribe((devices: DeviceData[]) => {
            for (const device of devices) {
                this.updateWdaStatus(device.Info.UniqueDeviceID);
            }
        });
    }

    onImageClick(udid: string, event: MouseEvent, img: HTMLImageElement) {
        const session: DeviceSession = this.sessions[udid];
        if (!session?.width || !session?.height) {
            console.error('Нет размеров экрана для устройства', udid);
            return;
        }

        const rect = img.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const realX = x * (session.width / rect.width);
        const realY = y * (session.height / rect.height);

        this.deviceApiService.tap(udid, session.id, Math.round(realX), Math.round(realY)).subscribe({
            next: () => console.log('Tap sent to WDA:', Math.round(realX), Math.round(realY)),
            error: err => console.error('WDA tap error:', err)
        });
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        this.fileName = file ? file.name : '';
    }
    checkWdaFromDevice(device: DeviceData) {
        return device.WDA.status === 'created';
    }

    onGo(udid: string) {
        if (this.selectedAction === 'install') {
            // Получить файл
            const fileList = this.fileInput.nativeElement.files;
            if (!fileList || fileList.length === 0) {
                alert('Выберите файл для установки!');
                return;
            }
            if (fileList.length > 1) {
                alert('Может быть только один файл');
                return;
            }
            const file = fileList[0];
            console.log('Устанавливаем приложение из файла:', file);
            this.deviceApiService.installApp(udid, file).subscribe()
        } else {
            if (!this.bundleId) {
                alert('Введите Bundle ID!');
                return;
            }
            const bundleId = this.bundleId.replaceAll("x5.", "lanit.")
            if ((this.selectedAction === 'start')) {
                // Здесь ваша логика для работы с Bundle ID
                console.log('Запускаем:', this.bundleId);
                this.deviceApiService.startApp(udid, bundleId).subscribe()
            } else if ((this.selectedAction === 'stop')) {
                // Здесь ваша логика для работы с Bundle ID
                console.log('Запускаем:', this.bundleId);
                this.deviceApiService.stopApp(udid, bundleId).subscribe()
            } else if ((this.selectedAction === 'delete')) {
                // Здесь ваша логика для работы с Bundle ID
                console.log('Запускаем:', this.bundleId);
                this.deviceApiService.deleteApp(udid, bundleId).subscribe()
            }
        }
    }


    connect() {
        // Замените на ваш WebSocket URL
        this.webSocketService.connect(this.wsUrl);
        this.isConnected = true;
    }

    disconnect() {
        this.webSocketService.disconnect();
        this.isConnected = false;
    }
}
