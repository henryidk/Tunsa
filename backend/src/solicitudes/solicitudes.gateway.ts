import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: '/solicitudes',
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true },
})
export class SolicitudesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SolicitudesGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    this.logger.log(`[WS] Intento de conexión: ${client.id}`);
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        this.logger.warn(`[WS] Sin token — desconectando ${client.id}`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<{ sub: string; username: string; role: string }>(token);
      const { role, username } = payload;
      this.logger.log(`[WS] Conectado: ${client.id} | sub=${payload.sub} | role=${role}`);

      if (role === 'admin' || role === 'secretaria') {
        client.join(`rol:${role}`);
        this.logger.log(`[WS] ${client.id} unido a sala rol:${role}`);
      } else if (role === 'encargado_maquinas') {
        client.join(`user:${username}`);
        this.logger.log(`[WS] ${client.id} unido a sala user:${username}`);
      } else {
        this.logger.warn(`[WS] Rol no permitido (${role}) — desconectando ${client.id}`);
        client.disconnect();
      }
    } catch (err) {
      this.logger.error(`[WS] Error verificando token de ${client.id}: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[WS] Desconectado: ${client.id}`);
  }

  emitNuevaSolicitud(solicitud: object) {
    try {
      this.logger.log('[WS] Emitiendo solicitud:nueva a rol:admin, rol:secretaria');
      this.server.to('rol:admin').to('rol:secretaria').emit('solicitud:nueva', solicitud);
    } catch (err) {
      this.logger.error(`[WS] Error emitiendo solicitud:nueva: ${(err as Error).message}`);
    }
  }

  emitSolicitudAprobada(solicitud: object, username: string) {
    try {
      this.logger.log(`[WS] Emitiendo solicitud:aprobada a user:${username}`);
      this.server.to(`user:${username}`).emit('solicitud:aprobada', solicitud);
    } catch (err) {
      this.logger.error(`[WS] Error emitiendo solicitud:aprobada: ${(err as Error).message}`);
    }
  }

  emitSolicitudRechazada(solicitud: object, username: string) {
    try {
      this.logger.log(`[WS] Emitiendo solicitud:rechazada a user:${username}`);
      this.server.to(`user:${username}`).emit('solicitud:rechazada', solicitud);
    } catch (err) {
      this.logger.error(`[WS] Error emitiendo solicitud:rechazada: ${(err as Error).message}`);
    }
  }

  emitRentaVencida(solicitud: object, username: string) {
    try {
      this.logger.log(`[WS] Emitiendo renta:vencida a user:${username}`);
      this.server.to(`user:${username}`).emit('renta:vencida', solicitud);
    } catch (err) {
      this.logger.error(`[WS] Error emitiendo renta:vencida: ${(err as Error).message}`);
    }
  }

  emitRentaActiva(solicitud: object, encargadoUsername: string) {
    try {
      this.logger.log(`[WS] Emitiendo renta:activa a rol:admin, rol:secretaria, user:${encargadoUsername}`);
      this.server
        .to('rol:admin')
        .to('rol:secretaria')
        .to(`user:${encargadoUsername}`)
        .emit('renta:activa', solicitud);
    } catch (err) {
      this.logger.error(`[WS] Error emitiendo renta:activa: ${(err as Error).message}`);
    }
  }
}
