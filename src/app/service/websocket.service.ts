import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface WebSocketMessage {
  type: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket!: WebSocket;
  private messageSubject = new Subject<WebSocketMessage>();
  public messages$ = this.messageSubject.asObservable();

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;

  constructor() {}

  // Подключение к WebSocket
  connect(url: string): void {
    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = (event) => {
        console.log('WebSocket connected successfully');
        this.reconnectAttempts = 0;
      };

      this.socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.messageSubject.next(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket connection closed');
        this.handleReconnection(url);
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  }

  // Отправка сообщения
  sendMessage(message: WebSocketMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  // Получение сообщений по типу
  getMessagesByType(type: string): Observable<any> {
    return this.messages$.pipe(
      filter(message => message.type === type),
      map(message => message.data)
    );
  }

  // Закрытие соединения
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
    }
  }

  // Проверка состояния соединения
  isConnected(): boolean {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  // Обработка переподключения
  private handleReconnection(url: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect(url);
      }, this.reconnectInterval);
    }
  }
}