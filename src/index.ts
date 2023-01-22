import { Server, Socket } from 'socket.io';
import { Client } from './Client';
import { IDisposable } from './interfaces/IDisposable';

const connectedClients: Record<string, IDisposable> = {};

async function main() {
  const io = new Server({ maxHttpBufferSize: 1e9 });

  io.on('connection', (socket: Socket) => {
    socket.on('disconnect', async () => {
      console.log(socket.id + ' disconnected');
      const clientDisposable = connectedClients[socket.id];
      if (clientDisposable) {
        await clientDisposable.dispose();
      }
    });
    console.log(socket.id + ' connected');
    connectedClients[socket.id] = new Client(socket);
  });

  io.listen(6969);
}

main();
