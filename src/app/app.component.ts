import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DevicesComponent } from './devices/devices.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DevicesComponent],
  templateUrl: './app.component.html',
  standalone: true,
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'ios-ui';
}
