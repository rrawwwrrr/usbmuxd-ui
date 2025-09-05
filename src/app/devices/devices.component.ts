import { AsyncPipe, CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { DeviceData, DeviceSession } from '../model/device';
import { DeviceApiService } from '../service/device.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-device-control',
    templateUrl: './devices.component.html',
    styleUrls: ['./devices.component.scss'],
    imports: [AsyncPipe, NgIf, NgFor,
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
    deviceCards: Observable<DeviceData[]>;
    deviceStatus: { [id: string]: boolean } = {};
    sessions: { [id: string]: DeviceSession } = {};
    intervalId: any;
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

    constructor(private deviceApiService: DeviceApiService) {
        this.sessions['00008030-001454190EEB802E'] = {
            id: "03D95C77-F828-4B1B-967F-DAF2576F0E80",
            width: 375,
            height: 667,
        }
        this.deviceCards = this.deviceApiService.getDevices()
    }


    ngOnInit() {
        this.updateAllWdaStatuses();
        this.intervalId = setInterval(() => {
            console.log(this.deviceStatus)
            this.updateAllWdaStatuses();
        }, 5000);
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
        // Логика запуска WDA
        console.log('Запуск WDA для устройства:', udid);
        this.deviceApiService.startWdaSession(udid).subscribe(

            () => {
                this.createSession(udid);
                this.deviceStatus[udid] = true
            }
        )
    }
    stopWda(udid: string): void {
        // Логика остановки WDA
        console.log('Запуск WDA для устройства:', udid);
        this.deviceApiService.stopWdaSession(udid).subscribe(
            () => this.deviceStatus[udid] = false
        )
    }

    getStreamUrl(udid: string) {
        return this.deviceApiService.getScreenStreamUrl(udid);
    }

    createSession(udid: string) {
        const capabilities = {
            browserName: 'chrome',
            version: 'latest',
            platform: 'MAC'
        };

        this.deviceApiService.createWdaSession(udid, capabilities)
            .subscribe({
                next: res => {
                    console.log('Сессия создана:', res);
                    this.sessions[udid] = { id: res as string, width: 0, height: 0 }
                    // Можно обновить статус, если нужно
                    // this.updateWdaStatus(udid);
                },
                error: err => {
                    console.error('Ошибка создания сессии:', err);
                }
            });
    }

    updateWdaStatus(deviceId: string) {
        this.deviceApiService.checkWdaActive(deviceId).subscribe(isActive => {
            this.deviceStatus[deviceId] = isActive;
        });
    }

    updateAllWdaStatuses() {
        this.deviceApiService.getDevices().subscribe((devices: DeviceData[]) => {
            for (const device of devices) {
                this.updateWdaStatus(device.Container.Info.UniqueDeviceID);
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

        // Переводим координаты клика в координаты экрана устройства:
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
            if ((this.selectedAction === 'start')) {
                // Здесь ваша логика для работы с Bundle ID
                console.log('Запускаем:', this.bundleId);
                this.deviceApiService.startApp(udid, this.bundleId).subscribe()
            } else if ((this.selectedAction === 'stop')) {
                // Здесь ваша логика для работы с Bundle ID
                console.log('Запускаем:', this.bundleId);
                this.deviceApiService.stopApp(udid, this.bundleId).subscribe()
            }else if ((this.selectedAction === 'delete')) {
                // Здесь ваша логика для работы с Bundle ID
                console.log('Запускаем:', this.bundleId);
                this.deviceApiService.deleteApp(udid, this.bundleId).subscribe()
            }
            // Например:
            // this.deviceService.doSomethingWithBundleId(this.bundleId).subscribe(...)
        }
    }
}
