export type WebSocketMessage = Record<string, unknown>;
export type WebSocketMessageHandler = (message: WebSocketMessage) => void;

const DEFAULT_WS_PATH = '/ws/propagation';

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private handlers = new Set<WebSocketMessageHandler>();

  async connect(ticket: string): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    this.disconnect();

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(getWebSocketUrl());
      let authenticated = false;

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'auth', ticket }));
      };

      socket.onmessage = (event) => {
        const message = parseMessage(event.data);

        if (!authenticated) {
          if (message.type === 'auth_ok') {
            authenticated = true;
            resolve();
            return;
          }

          if (message.type === 'error') {
            reject(new Error(String(message.message || 'WebSocket authentication failed')));
            socket.close();
            return;
          }
        }

        this.handlers.forEach((handler) => handler(message));
      };

      socket.onerror = () => {
        reject(new Error('WebSocket connection failed'));
      };

      socket.onclose = () => {
        if (!authenticated) {
          reject(new Error('WebSocket closed before authentication completed'));
        }
        if (this.socket === socket) {
          this.socket = null;
        }
      };

      this.socket = socket;
    });
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  send(message: WebSocketMessage): void {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected');
    }

    this.socket?.send(JSON.stringify(message));
  }

  subscribe(handler: WebSocketMessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}

let websocketClient: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!websocketClient) {
    websocketClient = new WebSocketClient();
  }

  return websocketClient;
}

function getWebSocketUrl(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_WS_PATH;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${DEFAULT_WS_PATH}`;
}

function parseMessage(data: unknown): WebSocketMessage {
  if (typeof data !== 'string') {
    return { type: 'message', data };
  }

  try {
    return JSON.parse(data) as WebSocketMessage;
  } catch {
    return { type: 'message', data };
  }
}
