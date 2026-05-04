import { Injectable } from '@angular/core';
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'https://auth.rrawww.ru',
  realm: 'home',
  clientId: 'hub-ui',
});

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _initialized = false;

  getKeycloak(): Keycloak {
    return keycloak;
  }

  async init(): Promise<boolean> {
    if (this._initialized) return keycloak.authenticated ?? false;

    const authenticated = await keycloak.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });

    this._initialized = true;

    // Авторефреш токена за 30 секунд до истечения
    setInterval(async () => {
      try {
        await keycloak.updateToken(30);
      } catch {
        keycloak.login();
      }
    }, 10_000);

    return authenticated;
  }

  get token(): string {
    return keycloak.token ?? '';
  }

  get username(): string {
    return keycloak.tokenParsed?.['preferred_username'] ?? '';
  }

  logout(): void {
    keycloak.logout({ redirectUri: window.location.origin });
  }
}
