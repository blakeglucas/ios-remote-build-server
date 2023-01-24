import { Server, Socket } from 'socket.io';
import { ClientHandler } from './ClientHandler';

const connectedClients: Record<string, ClientHandler> = {};

async function main() {
  const io = new Server({ maxHttpBufferSize: 1e9 });

  io.on('connection', (socket: Socket) => {
    socket.on('disconnect', async () => {
      console.log(socket.id + ' disconnected');
      if (connectedClients[socket.id]) {
        // await clientDisposable.dispose();
        delete connectedClients[socket.id];
      }
    });
    console.log(socket.id + ' connected');
    connectedClients[socket.id] = new ClientHandler(socket);
  });

  const port = Number(process.env.PORT || 6969);
  io.listen(port);
}

main();
