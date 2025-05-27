import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  connect(token: string) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io({
      auth: {
        token
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Delivery partner methods
  sendLocationUpdate(latitude: number, longitude: number, orderId?: number) {
    if (this.socket?.connected) {
      this.socket.emit('location_update', { latitude, longitude, orderId });
    }
  }

  sendOrderStatusUpdate(orderId: number, status: string) {
    if (this.socket?.connected) {
      this.socket.emit('order_status_update', { orderId, status });
    }
  }

  // Event listeners
  onLocationUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('delivery_location_update', callback);
    }
  }

  onOrderStatusChange(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('order_status_changed', callback);
    }
  }

  onLocationUpdateSuccess(callback: () => void) {
    if (this.socket) {
      this.socket.on('location_update_success', callback);
    }
  }

  onLocationUpdateError(callback: (error: any) => void) {
    if (this.socket) {
      this.socket.on('location_update_error', callback);
    }
  }

  onOrderStatusUpdateSuccess(callback: () => void) {
    if (this.socket) {
      this.socket.on('order_status_update_success', callback);
    }
  }

  onOrderStatusUpdateError(callback: (error: any) => void) {
    if (this.socket) {
      this.socket.on('order_status_update_error', callback);
    }
  }

  // Remove listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  isSocketConnected() {
    return this.isConnected;
  }
}

export const socketService = new SocketService();