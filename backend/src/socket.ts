import { Server, Socket } from 'socket.io';

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Join circle room
    socket.on('join-circle', (circleId: string) => {
      socket.join(`circle:${circleId}`);
      console.log(`Socket ${socket.id} joined circle:${circleId}`);
    });

    // Leave circle room
    socket.on('leave-circle', (circleId: string) => {
      socket.leave(`circle:${circleId}`);
      console.log(`Socket ${socket.id} left circle:${circleId}`);
    });

    // Handle location update
    socket.on('location-update', (data: { circleId: string; userId: string; lat: number; lng: number }) => {
      socket.to(`circle:${data.circleId}`).emit('member-location', data);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}

// Helper to emit events to circle members
export function emitToCircle(io: Server, circleId: string, event: string, data: any) {
  io.to(`circle:${circleId}`).emit(event, data);
}
