import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { EspecialClienteGuard } from './guards/especial-cliente.guard';

@Module({
  controllers: [ClientesController],
  providers: [ClientesService, EspecialClienteGuard],
})
export class ClientesModule {}
