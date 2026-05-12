const socket = io();

const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages');
const typingIndicator = document.getElementById('typing-indicator');

let currentChannel = 'general';

// Join channel
socket.emit('join', { group_id: currentChannel });

// Receive message
socket.on('receive_message', (data) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex space-x-4 animate-in fade-in slide-in-from-bottom-2 duration-300';
    messageDiv.innerHTML = `
        <div class="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0">
            ${data.username[0].toUpperCase()}
        </div>
        <div>
            <div class="flex items-center space-x-2">
                <span class="font-bold text-emerald-400 text-sm">${data.username}</span>
                <span class="text-[10px] text-zinc-400">${data.timestamp}</span>
            </div>
            <p class="text-sm text-zinc-200">${data.content}</p>
        </div>
    `;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// Typing indicator
let typingTimeout;
messageInput.addEventListener('input', () => {
    socket.emit('typing', { group_id: currentChannel });
});

socket.on('user_typing', (data) => {
    typingIndicator.innerText = `${data.username} is typing...`;
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        typingIndicator.innerText = '';
    }, 2000);
});

// Send message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (content) {
        socket.emit('send_message', {
            group_id: currentChannel,
            content: content
        });
        messageInput.value = '';
    }
});
