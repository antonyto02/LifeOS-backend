import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'ws';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TradingGateway implements OnGatewayConnection, OnGatewayDisconnect {

  @WebSocketServer()
  server: Server;

  private clients: Set<any> = new Set();

  // Cuando un cliente se conecta
  handleConnection(client: any) {
    this.clients.add(client);
    console.log('🟢 Cliente conectado. Total:', this.clients.size);
  }

  // Cuando un cliente se desconecta
  handleDisconnect(client: any) {
    this.clients.delete(client);
    console.log('🔴 Cliente desconectado. Total:', this.clients.size);
  }

  // Método para enviar el JSON al frontend
  broadcast(payload: any) {
    const message = JSON.stringify(payload);

    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }
}
