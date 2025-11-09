/* === public/client.js === */
const socket = io();
let currentRoom = null;
let myUsername = null;

// Active users display
socket.on('activeUsers', (n) => {
  const el = document.getElementById('activeUsers');
  if (el) el.textContent = `🟢 Active: ${n}`;
});

const $start = document.getElementById('start');
const $gender = document.getElementById('gender');
const $join = document.getElementById('join');
const $chat = document.getElementById('chat');
const $messages = document.getElementById('messages');
const $msg = document.getElementById('msg');
const $send = document.getElementById('send');
const $status = document.getElementById('status');
const $username = document.getElementById('username');
const $partnerName = document.getElementById('partnerName');
const $partnerGender = document.getElementById('partnerGender');
const $skip = document.getElementById('skip');
const $typing = document.getElementById('typing');
const $leaveBtn = document.getElementById('leaveBtn');

let typing = false;
let typingTimeout;

$leaveBtn.addEventListener('click', () => {
  if (confirm('Do you want to leave the chat?')) {
    socket.disconnect();
    location.reload();
  }
});

$start.onclick = () => {
  const gender = $gender.value;
  socket.emit('findPartner', { gender });
  $status.textContent = 'Searching for a partner...';
};

let noteShown = false;

socket.on('waiting', () => {
  $status.textContent = 'Waiting for someone of a different gender...';
  $join.classList.add('hidden');
  $chat.classList.remove('hidden');
  $messages.innerHTML = '';
  $partnerName.textContent = '—';
  $partnerGender.textContent = '—';

  // 💌 Personalized message for Khushi
  if (!noteShown) {
    const note = document.createElement('div');
    note.className = "text-center text-yellow-400 text-sm mt-2 italic leading-relaxed";
    note.innerHTML = `
      Hey <b>Khushi</b>, are you waiting for me to join? 💬<br/>
      I just got a notification that you’re here, so please wait a few minutes — I might join soon <br/>
      <span class="text-gray-500 text-xs">(If you’re not Khushi, please ignore this message ☺️)</span>
    `;
    $messages.appendChild(note);
    $messages.scrollTop = $messages.scrollHeight;
    noteShown = true;
  }
});

socket.on('chatStart', (data) => {
  currentRoom = data.room;
  myUsername = data.username;
  $username.textContent = myUsername;
  $partnerName.textContent = data.partnerUsername || '—';
  $partnerGender.textContent = data.partnerGender || '—';
  $status.textContent = 'Connected';
  $join.classList.add('hidden');
  $chat.classList.remove('hidden');
  appendSystem(`Connected to ${$partnerName.textContent} (${$partnerGender.textContent})`);
});

$send.onclick = sendMessage;

$msg.addEventListener('input', () => {
  if (!typing) {
    typing = true;
    socket.emit('typing', { room: currentRoom, typing: true });
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typing = false;
    socket.emit('typing', { room: currentRoom, typing: false });
  }, 1000);
});

$msg.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

function sendMessage() {
  const text = $msg.value.trim();
  if (!text || !currentRoom) return;
  socket.emit('message', { room: currentRoom, msg: text });
  appendMessage('you', text);
  $msg.value = '';
  socket.emit('typing', { room: currentRoom, typing: false });
}

socket.on('message', (data) => {
  if (data.user === myUsername) return;
  appendMessage('them', data.msg, data.user);
});

socket.on('typing', ({ user, typing }) => {
  $typing.textContent = typing ? `${user} is typing...` : '';
});

socket.on('partnerLeft', () => {
  appendSystem('Partner disconnected');
  $status.textContent = 'Partner left. Searching for new partner...';
  currentRoom = null;
});

$skip.onclick = () => {
  if (confirm('Are you sure you want to skip this chat?')) {
    socket.emit('next');
    $messages.innerHTML = '';
  }
  if (currentRoom) socket.emit('skip', { room: currentRoom });
  else {
    const gender = $gender.value;
    socket.emit('findPartner', { gender });
  }
  $messages.innerHTML = '';
  $partnerName.textContent = '—';
  $partnerGender.textContent = '—';
  $status.textContent = 'Searching...';
};

function appendMessage(cls, text, who) {
  const div = document.createElement('div');
  div.className = 'flex items-baseline';
  const isMe = cls === 'you';
  const name = isMe ? 'Me' : (who || 'Stranger');
  div.innerHTML = `
    <span class="font-semibold ${isMe ? 'text-green-400' : 'text-blue-400'} mr-2">${name}:</span>
    <span class="text-gray-200">${text}</span>
  `;
  $messages.appendChild(div);
  $messages.scrollTop = $messages.scrollHeight;
}

function appendSystem(text) {
  const div = document.createElement('div');
  div.className = 'muted';
  div.style.textAlign = 'center';
  div.style.margin = '8px 0';
  div.textContent = text;
  $messages.appendChild(div);
  $messages.scrollTop = $messages.scrollHeight;
}
