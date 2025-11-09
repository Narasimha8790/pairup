/* === server.js (modified) === */
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');


const app = express();
const server = http.createServer(app);
const io = new Server(server);

// === Email Notification Setup ===
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'narasimha.golla1117@gmail.com',       // 👈 your Gmail
    pass: 'knnu gner kdja vivt'     // 👈 16-char App Password
  }
});

let lastEmailTime = 0;
const EMAIL_COOLDOWN = 5 * 60 * 1000; // 5 minutes

function sendEmail(subject, message) {
  const now = Date.now();
  if (now - lastEmailTime < EMAIL_COOLDOWN) return; // avoid spamming
  lastEmailTime = now;

  const mailOptions = {
    from: '"PairUp Bot" <narasimha.golla1117@gmail.com>',
    to: 'gnarasimhayadav123@gmail.com', // 👈 or any recipient address
    subject,
    text: message
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error('❌ Email error:', err);
    else console.log('✅ Email sent:', info.response);
  });
}


// Emit current active users count to all clients
function emitActive() {
  try {
    const count = io.of('/').sockets.size || 0;
    io.emit('activeUsers', count);

    // Send email when threshold reached
    const threshold = 1; // 👈 you can change this number
    if (count >= threshold) {
      sendEmail(
        `🔥 ${count} active users online on PairUp`,
        `There are currently ${count} users online — perfect time to chat!`
      );
    }

  } catch (e) {
    console.error('emitActive error', e);
  }
}


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
  if (gender === 'male') {
    if (waiting.female.length) return waiting.female.shift();
  } else if (gender === 'female') {
    if (waiting.male.length) return waiting.male.shift();
  }
  const options = Object.keys(waiting);
  for (const k of options) {
    if (k !== gender && waiting[k].length) return waiting[k].shift();
  }
  return null;
}

io.on('connection', (socket) => {
  console.log('conn', socket.id);

  // update active users when a client connects
  emitActive();

  socket.on('findPartner', ({ gender }) => {
    const g = normalizeGender(gender);
    socket.data.gender = g;
    socket.data.username = 'User' + Math.floor(1000 + Math.random() * 9000);

    const partner = findOppositeWaiting(g);
    if (partner) {
      const room = socket.id + '#' + partner.id;
      partners.set(socket.id, partner.id);
      partners.set(partner.id, socket.id);

      socket.join(room);
      partner.join(room);

      socket.emit('chatStart', { room, username: socket.data.username, partnerUsername: partner.data.username, partnerGender: partner.data.gender });
      partner.emit('chatStart', { room, username: partner.data.username, partnerUsername: socket.data.username, partnerGender: socket.data.gender });
    } else {
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

    // update active users after a client disconnects
    emitActive();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server listening on', PORT));
