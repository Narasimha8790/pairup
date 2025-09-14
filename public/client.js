
/* === public/client.js === */
const socket = io();
let currentRoom = null;
let myUsername = null;

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
// const $input = document.getElementById('msg');
let typing = false;
let typingTimeout;

$leaveBtn.addEventListener('click', () => {
  if (confirm('Do you want to leave the chat?')) {
    socket.disconnect();
    location.reload(); // reload brings back to first page
  }
});


$start.onclick = () => {
  const gender = $gender.value;
  socket.emit('findPartner', { gender });
  $status.textContent = 'Searching for a partner...';
};

socket.on('waiting', () => {
  $status.textContent = 'Waiting for someone of a different gender...';
  $join.classList.add('hidden');
  $chat.classList.remove('hidden');
  $messages.innerHTML = '';
  $partnerName.textContent = '—';
  $partnerGender.textContent = '—';
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
  }, 1000); // stop typing after 1 sec of inactivity
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
  // show incoming
  if (data.user === myUsername) return; // already shown locally
  appendMessage('them', data.msg, data.user);
});

socket.on('typing', ({ user, typing }) => {
  if (typing) $typing.textContent = `${user} is typing...`;
  else $typing.textContent = '';
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
    // if not in room, just try to find partner again
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