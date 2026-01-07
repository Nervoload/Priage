// hospital-app/src/shared/types/domain.ts
// John Surette
// Dec 8, 2025
// socket.ts
// initialize Socket.IO client pointing at backend.

import { io, Socket } from 'socket.io-client';

export const socket: Socket = io('https://api.hospitalapp.com/realtime', {
    auth: {
        token: localStorage.getItem('authToken') || '',
    },
});
