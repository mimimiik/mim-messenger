const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" }, transports: ['websocket', 'polling'] });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let users = {}, chats = {}, onlineUsers = {};

app.post('/api/auth', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя обязательно' });
    const userId = 'user_' + Date.now();
    users[userId] = { userId, username };
    res.json({ success: true, user: { userId, username } });
});

app.get('/api/users', (req, res) => {
    res.json(Object.values(users).map(({ userId, username }) => ({ userId, username })));
});

app.get('/api/chats/:userId', (req, res) => {
    res.json(Object.values(chats).filter(chat => chat.participants.includes(req.params.userId)));
});

app.get('/api/messages/:chatId', (req, res) => {
    res.json(chats[req.params.chatId]?.messages || []);
});

app.post('/api/chats', (req, res) => {
    const { participants, name } = req.body;
    const chatId = 'chat_' + Date.now();
    chats[chatId] = { id: chatId, participants, name: name || 'Чат', messages: [] };
    res.json(chats[chatId]);
});

io.on('connection', (socket) => {
    let currentUserId = null;
    socket.on('auth', (userId) => {
        currentUserId = userId;
        onlineUsers[userId] = socket.id;
    });
    socket.on('send_message', (data) => {
        const { chatId, message } = data;
        if (!chats[chatId]) chats[chatId] = { id: chatId, participants: [message.senderId, message.recipientId], name: 'Чат', messages: [] };
        chats[chatId].messages.push(message);
        chats[chatId].participants.forEach(pid => {
            const sid = onlineUsers[pid];
            if (sid) io.to(sid).emit('new_message', { chatId, message });
        });
    });
    socket.on('disconnect', () => { if (currentUserId) delete onlineUsers[currentUserId]; });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Сервер запущен на порту ${PORT}`));
