const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { 
        origin: "*",
        methods: ["GET", "POST"]
    } 
});

// Regional Matchmaking Queues
let queues = {
    india: null,
    global: null
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('find-stranger', (data = {}) => {
        const filter = data.filter || 'global';
        
        // Remove from other queues
        Object.keys(queues).forEach(key => {
            if (queues[key] === socket) queues[key] = null;
        });

        if (queues[filter] && queues[filter].id !== socket.id) {
            // Match found!
            const stranger = queues[filter];
            queues[filter] = null;

            const id1 = socket.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
            const id2 = stranger.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
            const sortedIds = [id1, id2].sort();
            const roomId = `room${sortedIds.join('')}`;
            socket.join(roomId);
            stranger.join(roomId);
            
            socket.matchedRoom = roomId;
            stranger.matchedRoom = roomId;

            socket.emit('match-found', { strangerId: stranger.id, roomId: roomId });
            stranger.emit('match-found', { strangerId: socket.id, roomId: roomId });
            console.log(`Matched ${socket.id} with ${stranger.id} in Room [${roomId}] | Filter: [${filter}]`);
        } else {
            queues[filter] = socket;
            socket.emit('waiting', `Searching for someone in [${filter}]...`);
        }
    });

    socket.on('signal', (data) => {
        if(data.to) io.to(data.to).emit('signal', { from: socket.id, signal: data.signal });
    });

    socket.on('chat-message', (data) => {
        if(socket.matchedRoom) {
            socket.to(socket.matchedRoom).emit('chat-message', data);
        }
    });

    socket.on('disconnect', () => {
        Object.keys(queues).forEach(key => {
            if (queues[key] === socket) queues[key] = null;
        });
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Signaling Server running on port ${PORT}`));
