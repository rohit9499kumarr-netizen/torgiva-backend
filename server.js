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

let queues = { india: [], global: [] };

io.on('connection', (socket) => {
    console.log('[CONNECT] Naya user aaya:', socket.id);

    socket.on('find-stranger', (data = {}) => {
        const filter = data.filter || 'global';
        const rawInterest = data.interest ? data.interest.toLowerCase().trim() : '';
        const interest = rawInterest.replace(/[^a-z0-9]/g, ''); // Clean special chars
        
        console.log(`[QUEUE] ${socket.id} joined [${filter}] interest: [${interest || 'Any'}]`);
        
        // Safai: Remove user from all queues first
        Object.keys(queues).forEach(key => {
            queues[key] = queues[key].filter(s => s.id !== socket.id);
        });

        if (!queues[filter]) queues[filter] = [];
        
        let matchIndex = -1;
        
        // Matchmaking logic
        if (interest) {
            // 1. Try to find someone with exact same interest
            matchIndex = queues[filter].findIndex(s => s.interest === interest && s.id !== socket.id);
            // 2. If nobody has that exact interest, match with someone without any interest (fallback) so they don't wait forever
            if (matchIndex === -1) {
                matchIndex = queues[filter].findIndex(s => !s.interest && s.id !== socket.id);
            }
        } else {
            // 3. If I have no interest, match me with anyone at all
            matchIndex = queues[filter].findIndex(s => s.id !== socket.id);
        }

        if (matchIndex !== -1) {
            // MATCH FOUND!
            const stranger = queues[filter].splice(matchIndex, 1)[0];

            const id1 = socket.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
            const id2 = stranger.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
            const sortedIds = [id1, id2].sort();
            const roomId = `room${sortedIds.join('')}`;

            console.log(`[MATCH SUCCESS] ${socket.id} & ${stranger.id} in ${roomId}`);

            socket.join(roomId);
            stranger.join(roomId);
            
            socket.matchedRoom = roomId;
            stranger.matchedRoom = roomId;

            // Pass identities to each other
            socket.emit('match-found', { 
                strangerId: stranger.id, roomId: roomId, 
                firebaseUid: stranger.firebaseUid, username: stranger.username 
            });
            stranger.emit('match-found', { 
                strangerId: socket.id, roomId: roomId, 
                firebaseUid: data.firebaseUid, username: data.username 
            });
        } else {
            // Wait in line
            socket.interest = interest;
            socket.firebaseUid = data.firebaseUid;
            socket.username = data.username;
            queues[filter].push(socket);
            console.log(`[WAITING] ${socket.id} queue mein hai... (Queue size: ${queues[filter].length})`);
        }
    });

    socket.on('disconnect', () => {
        Object.keys(queues).forEach(key => {
            queues[key] = queues[key].filter(s => s.id !== socket.id);
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
