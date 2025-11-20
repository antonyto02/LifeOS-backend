import { Injectable } from '@nestjs/common';
import { WebSocketServer } from 'ws';
import { SnapshotBuilder } from './snapshot.builder';

@Injectable()
export class SnapshotGateway {
  private readonly wss = new WebSocketServer({ noServer: true });

  constructor(private readonly snapshotBuilder: SnapshotBuilder) {}

  bindServer(server: any) {
    server.on('upgrade', (req, socket, head) => {
      if (req.url === '/ws/snapshot') {
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit('connection', ws, req);
        });
      }
    });
  }

  broadcastSnapshot() {
    const snapshot = this.snapshotBuilder.buildFullSnapshot();
    const json = JSON.stringify(snapshot);

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(json);
      }
    });
  }
}
