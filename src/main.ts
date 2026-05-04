import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { AuthService } from './app/service/auth.service';

const auth = new AuthService();

auth.init().then((authenticated) => {
  if (!authenticated) {
    // login-required сам редиректит, но на всякий случай
    return;
  }
  bootstrapApplication(AppComponent, appConfig)
    .catch((err) => console.error(err));
});
