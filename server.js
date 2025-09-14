/* === server.js === */
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Waiting pools keyed by gender label (lowercase)
const waiting = {
  male: [],
  female: [],
  other: []
};

// Map socket.id -> partnerSocketId
const partners = new Map();

function normalizeGender(g) {
  if (!g) return 'other';
  const s = String(g).trim().toLowerCase();
  if (s === 'male' || s === 'm') return 'male';
  if (s === 'female' || s === 'f') return 'female';
  return 'other';
}

function findOppositeWaiting(gender) {
  // We consider "opposite" to mean "different gender".
  // Prefer male <-> female pairing first. If none, pick any different gender.
  if (gender === 'male') {
    if (waiting.female.length) return waiting.female.shift();
  } else if (gender === 'female') {
    if (waiting.male.length) return waiting.male.shift();
  }
  // fallback: any socket in waiting with different gender
  const options = Object.keys(waiting);
  for (const k of options) {
    if (k !== gender && waiting[k].length) return waiting[k].shift();
  }
  return null;
}

io.on('connection', (socket) => {
  console.log('conn', socket.id);

  socket.on('findPartner', ({ gender }) => {
    const g = normalizeGender(gender);
    socket.data.gender = g;
    socket.data.username = 'User' + Math.floor(1000 + Math.random() * 9000);

    const partner = findOppositeWaiting(g);
    if (partner) {
      // create room id
      const room = socket.id + '#' + partner.id;
      partners.set(socket.id, partner.id);
      partners.set(partner.id, socket.id);

      socket.join(room);
      partner.join(room);

      // notify both
      socket.emit('chatStart', { room, username: socket.data.username, partnerUsername: partner.data.username, partnerGender: partner.data.gender });
      partner.emit('chatStart', { room, username: partner.data.username, partnerUsername: socket.data.username, partnerGender: socket.data.gender });
    } else {
      // push to waiting list
      waiting[g].push(socket);
      socket.emit('waiting');
    }
  });

  socket.on('message', ({ room, msg }) => {
    if (!room) return;
    io.to(room).emit('message', { user: socket.data.username, msg });
  });

  socket.on('typing', ({ room, typing }) => {
    if (!room) return;
    socket.to(room).emit('typing', { user: socket.data.username, typing });
  });

  socket.on('skip', ({ room }) => {
    // Leave current partner and try to find a new one
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        const roomId = room;
        socket.leave(roomId);
        partnerSocket.leave(roomId);
        partners.delete(socket.id);
        partners.delete(partnerId);
        partnerSocket.emit('partnerLeft');
      }
    }
    // attempt to find a new partner again
    const g = socket.data.gender || 'other';
    const partner = findOppositeWaiting(g);
    if (partner) {
      const newRoom = socket.id + '#' + partner.id;
      partners.set(socket.id, partner.id);
      partners.set(partner.id, socket.id);
      socket.join(newRoom);
      partner.join(newRoom);
      socket.emit('chatStart', { room: newRoom, username: socket.data.username, partnerUsername: partner.data.username, partnerGender: partner.data.gender });
      partner.emit('chatStart', { room: newRoom, username: partner.data.username, partnerUsername: socket.data.username, partnerGender: socket.data.gender });
    } else {
      waiting[g].push(socket);
      socket.emit('waiting');
    }
  });

  socket.on('disconnect', () => {
    // remove from waiting lists
    for (const k of Object.keys(waiting)) {
      const idx = waiting[k].findIndex(s => s.id === socket.id);
      if (idx !== -1) waiting[k].splice(idx, 1);
    }

    const partnerId = partners.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partnerLeft');
        partners.delete(partnerId);
      }
      partners.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server listening on', PORT));



/* === README (run instructions) === */
/*
1. Save files into a folder structure:
   - package.json
   - server.js
   - /public/index.html
   - /public/client.js
   - /public/style.css

2. In the project root run:
   npm install

3. Start server:
   npm start

4. Open http://localhost:3000 in two different browser windows (or devices).

Notes:
- This demo keeps all state in-memory (no DB). For production use you should add
  rate-limiting, moderation, content filters, persistent storage, and scaling.
- The pairing logic tries to match users of different genders (male <-> female) first
  and otherwise any different gender.
*/
