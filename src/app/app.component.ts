import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DevicesComponent } from './devices/devices.component';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, DevicesComponent], // Добавь сюда свой компонент
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'ios-ui';
}
