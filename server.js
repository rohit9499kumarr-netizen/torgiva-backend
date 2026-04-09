const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS fix for extra stability
const io = new Server(server, { 
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"]
    } 
});

let queues = { india: null, global: null };

io.on('connection', (socket) => {
    console.log('[CONNECT] Naya user aaya:', socket.id);

    socket.on('find-stranger', (data = {}) => {
        const filter = data.filter || 'global';
        console.log(`[QUEUE] ${socket.id} ne [${filter}] queue join ki`);
        
        // Safai: Check if user already in a queue
        Object.keys(queues).forEach(key => {
            if (queues[key] && queues[key].id === socket.id) queues[key] = null;
        });

        if (queues[filter] && queues[filter].id !== socket.id) {
            // MATCH FOUND!
            const stranger = queues[filter];
            queues[filter] = null;

            const id1 = socket.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
            const id2 = stranger.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
            const sortedIds = [id1, id2].sort();
            const roomId = `room${sortedIds.join('')}`;

            console.log(`[MATCH SUCCESS] ${socket.id} & ${stranger.id} in ${roomId}`);

            socket.join(roomId);
            stranger.join(roomId);
            
            socket.matchedRoom = roomId;
            stranger.matchedRoom = roomId;

            socket.emit('match-found', { strangerId: stranger.id, roomId: roomId });
            stranger.emit('match-found', { strangerId: socket.id, roomId: roomId });
        } else {
            // Wait in line
            queues[filter] = socket;
            console.log(`[WAITING] ${socket.id} queue mein hai...`);
        }
    });

    socket.on('disconnect', () => {
        Object.keys(queues).forEach(key => {
            if (queues[key] && queues[key].id === socket.id) queues[key] = null;
        });
        console.log('[DISCONNECT] User chala gaya:', socket.id);
    });

    // 📩 Signal Relay: Chat aur WebRTC signals ko ek doosre tak pahunchane ke liye
    socket.on('signal', (data) => {
        if (data.to && data.signal) {
            io.to(data.to).emit('signal', {
                from: socket.id,
                signal: data.signal
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
// Render bind fix
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server live hai port ${PORT} par!`);
});
