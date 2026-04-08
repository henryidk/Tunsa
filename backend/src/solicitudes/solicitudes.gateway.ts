import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: '/solicitudes',
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class SolicitudesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) { client.disconnect(); return; }

      const payload = this.jwtService.verify<{ sub: string; role: string }>(token);
      const role = payload.role;

      if (role === 'admin' || role === 'secretaria') {
        client.join(`rol:${role}`);
      } else {
        client.disconnect();
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {}

  emitNuevaSolicitud(solicitud: object) {
    this.server
      .to('rol:admin')
      .to('rol:secretaria')
      .emit('solicitud:nueva', solicitud);
  }
}
