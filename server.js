const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');

// Initialize the Express app and create an HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
// Track connected users and their rooms
const rooms = {};


// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Handle room join requests
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }
    
    // Add user to room
    rooms[roomId].push(userId);
    
    // Notify other users in the room
    socket.to(roomId).emit('user-connected', userId);
    
    console.log(`User ${userId} joined room ${roomId}`);
    
    // Send list of existing users to the new participant
    const existingUsers = rooms[roomId].filter(id => id !== userId);
    if (existingUsers.length > 0) {
      socket.emit('existing-users', existingUsers);
    }
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      
      // Remove user from room
      if (rooms[roomId]) {
        rooms[roomId] = rooms[roomId].filter(id => id !== userId);
        
        // Delete room if empty
        if (rooms[roomId].length === 0) {
          delete rooms[roomId];
        }
      }
      
      // Notify others that user disconnected
      socket.to(roomId).emit('user-disconnected', userId);
    });
  });
  
  // Forward WebRTC signaling messages
  socket.on('offer', (offer, roomId, fromUserId, toUserId) => {
    socket.to(roomId).emit('offer', offer, fromUserId, toUserId);
  });
  
  socket.on('answer', (answer, roomId, fromUserId, toUserId) => {
    socket.to(roomId).emit('answer', answer, fromUserId, toUserId);
  });
  
  socket.on('ice-candidate', (candidate, roomId, fromUserId, toUserId) => {
    socket.to(roomId).emit('ice-candidate', candidate, fromUserId, toUserId);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
