// test-socket.js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5050', {
  auth: {
    userId: "6813b81978b0416de3ef364b"
  }
});

socket.on('connect', () => {
  console.log('Connected!');
  
  // Join hiring chat
  socket.emit('join-hiring-chat', '681ca4c42b269416922bcd4f');
  
  // Send message
  socket.emit('send-message', {
    hiringId: '681ca4c42b269416922bcd4f',
    senderId: '6813b81978b0416de3ef364b',
    recipientId: '6813b74a78b0416de3ef363a',
    content: 'New message from test'
  });
});

socket.on('receive-message', (msg) => {
  console.log('New message:', msg);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});