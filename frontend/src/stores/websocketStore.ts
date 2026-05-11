import { create } from 'zustand';

export interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  lastMessageTime: number | null;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: Error | null) => void;
  setLastMessageTime: (lastMessageTime: number) => void;
}

export const useWebSocketStore = create<WebSocketState>((set) => ({
  connected: false,
  connecting: false,
  error: null,
  lastMessageTime: null,
  setConnected: (connected) => set({ connected, connecting: false }),
  setConnecting: (connecting) => set({ connecting }),
  setError: (error) => set({ error }),
  setLastMessageTime: (lastMessageTime) => set({ lastMessageTime }),
}));
