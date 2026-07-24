const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let activeRooms = {}; 

io.on('connection', (socket) => {
    
    socket.on('joinRoom', ({ roomId }) => {
        socket.join(roomId);
        
        if (!activeRooms[roomId]) {
            activeRooms[roomId] = { players: [], bets: {} };
        }
        
        if (activeRooms[roomId].players.length < 5) {
            activeRooms[roomId].players.push(socket.id);
        }

        io.to(roomId).emit('roomUpdate', {
            count: activeRooms[roomId].players.length,
            players: activeRooms[roomId].players.map(id => ({
                id,
                hasBet: !!activeRooms[roomId].bets[id]
            }))
        });
    });

    socket.on('placeBet', ({ roomId, bet }) => {
        if (activeRooms[roomId]) {
            activeRooms[roomId].bets[socket.id] = bet;
            
            io.to(roomId).emit('roomUpdate', {
                count: activeRooms[roomId].players.length,
                players: activeRooms[roomId].players.map(id => ({
                    id,
                    hasBet: !!activeRooms[roomId].bets[id]
                }))
            });

            if (Object.keys(activeRooms[roomId].bets).length === 5) {
                processGameOutcome(roomId);
            }
        }
    });

    socket.on('disconnect', () => {
        for (let roomId in activeRooms) {
            activeRooms[roomId].players = activeRooms[roomId].players.filter(id => id !== socket.id);
            delete activeRooms[roomId].bets[socket.id];
            io.to(roomId).emit('roomUpdate', {
                count: activeRooms[roomId].players.length,
                players: activeRooms[roomId].players.map(id => ({ id, hasBet: !!activeRooms[roomId].bets[id] }))
            });
        }
    });
});

function processGameOutcome(roomId) {
    const room = activeRooms[roomId];
    const playerIds = room.players;
    
    const shuffledPlayers = [...playerIds].sort(() => 0.5 - Math.random());
    const winningPlayers = shuffledPlayers.slice(0, 3); 

    const finalReport = playerIds.map(id => ({
        id: id,
        isWinner: winningPlayers.includes(id),
        payout: winningPlayers.includes(id) ? 100 : 0
    }));

    io.to(roomId).emit('gameResults', finalReport);
    delete activeRooms[roomId];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Game engine live on port ${PORT}`));
