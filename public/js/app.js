// Main application logic for WebRTC video calling app

// Global variables
let socket;
let localStream;
let localScreenStream;
let userId;
let roomId;
let peerConnections = {};
let isScreenSharing = false;
let isAudioMuted = false;
let isVideoOff = false;
let peerConnection;


// When creating peer connections
// peerConnection.oniceconnectionstatechange = () => {
//   console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
  
//   // Log connection failures
//   if (peerConnection.iceConnectionState === 'failed') {
//     console.error('ICE connection failed');
//     // Notify the user and/or implement fallback
//   }
// };

// // Monitor candidate gathering
// peerConnection.onicegatheringstatechange = () => {
//   console.log(`ICE gathering state: ${peerConnection.iceGatheringState}`);
// };

// // Log candidate types to understand connectivity paths
// peerConnection.onicecandidate = (event) => {
//   if (event.candidate) {
//     console.log(`ICE candidate: ${event.candidate.candidate}`);
//     // Analyze candidate types (host, srflx, relay) for monitoring
//   }
// };

//end here

// STUN/TURN servers for ICE candidates
const iceServers = {
  iceServers: [
    //google's public STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Add TURN servers for production
    // {
    //   urls: 'turn:your-turn-server.com',
    //   username: 'username',
    //   credential: 'credential'
    // }
  ]
};

// DOM elements
const joinContainer = document.getElementById('join-container');
const callContainer = document.getElementById('call-container');
const roomIdInput = document.getElementById('room-id');
const joinBtn = document.getElementById('join-btn');
const createBtn = document.getElementById('create-btn');
const roomIdDisplay = document.getElementById('room-id-display');
const copyBtn = document.getElementById('copy-btn');
const leaveBtn = document.getElementById('leave-btn');
const videoGrid = document.getElementById('video-grid');
const localVideo = document.getElementById('local-video');
const muteBtn = document.getElementById('mute-btn');
const videoBtn = document.getElementById('video-btn');
const screenShareBtn = document.getElementById('screen-share-btn');



// write a function that will fetch the email and id of the connected user.


function init() {
    // userId = 1234567890
    // generate a unique userId
    userId = uuid.v4()

    socket = io();
    // Set up event listeners
  joinBtn.addEventListener('click', joinRoom);
  createBtn.addEventListener('click', createRoom);
  copyBtn.addEventListener('click', copyRoomId);
  leaveBtn.addEventListener('click', leaveRoom);
  muteBtn.addEventListener('click', toggleAudio);
  videoBtn.addEventListener('click', toggleVideo);
  screenShareBtn.addEventListener('click', toggleScreenShare);

  // Set up Socket.IO event handlers
  setupSocketListeners();
}


//setup socket.IO event listeners
function setupSocketListeners(){
    socket.on('user-connected', (newUserId) => {
        console.log(`User connected: ${newUserId}`);
        // Create a peer connection for the new user
        createPeerConnection(newUserId);
        // Send an offer to the new user
        createOffer(newUserId);
      });
      
      socket.on('user-disconnected', (userId) => {
        console.log(`User disconnected: ${userId}`);
        // Close and remove the peer connection
        if (peerConnections[userId]) {
          peerConnections[userId].close();
          delete peerConnections[userId];
        }
        
        // Remove the user's video element
        const videoElement = document.getElementById(`video-${userId}`);
        if (videoElement) {
          videoElement.parentElement.remove();
        }
      });
      
      socket.on('existing-users', (users) => {
        console.log('Existing users in room:', users);
        // Create peer connections for existing users
        users.forEach(userId => {
          createPeerConnection(userId);
          createOffer(userId);
        });
      });
      
      socket.on('offer', async (offer, fromUserId) => {
        console.log(`Received offer from: ${fromUserId}`);
        // Create a peer connection if it doesn't exist
        if (!peerConnections[fromUserId]) {
          createPeerConnection(fromUserId);
        }
        
        try {
          // Set the remote description
          await peerConnections[fromUserId].setRemoteDescription(new RTCSessionDescription(offer));
          
          // Create an answer
          const answer = await peerConnections[fromUserId].createAnswer();
          await peerConnections[fromUserId].setLocalDescription(answer);
          
          // Send the answer back
          socket.emit('answer', answer, roomId, userId, fromUserId);
        } catch (error) {
          console.error('Error handling offer:', error);
        }
      });
      
      socket.on('answer', async (answer, fromUserId) => {
        console.log(`Received answer from: ${fromUserId}`);
        try {
          await peerConnections[fromUserId].setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error('Error handling answer:', error);
        }
      });
      
      socket.on('ice-candidate', async (candidate, fromUserId) => {
        console.log(`Received ICE candidate from: ${fromUserId}`);
        try {
          if (peerConnections[fromUserId]) {
            await peerConnections[fromUserId].addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      });
    }
    
    // Join an existing room
    async function joinRoom() {
      const roomIdValue = roomIdInput.value.trim();
      if (!roomIdValue) {
        alert('Please enter a room ID');
        return;
      }
      
      roomId = roomIdValue;
      await startLocalStream();
      joinCall();
    }
    
    // Create a new room
    async function createRoom() {
      roomId = uuid.v4().substring(0, 8);
      await startLocalStream();
      joinCall();
    }
    
    // Start the local media stream
    async function startLocalStream() {
      try {
        // Get local media stream
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        });
        
        // Display local video
        localVideo.srcObject = localStream;
      } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Failed to access camera and microphone. Please check permissions.');
      }
    }
    
    // Join the video call
    function joinCall() {
      // Hide join container and show call container
      joinContainer.classList.add('hidden');
      callContainer.classList.remove('hidden');
      
      // Display room ID
      roomIdDisplay.textContent = roomId;
      
      // Join the room
      socket.emit('join-room', roomId, userId);
      //write javascript code that will display "user {userId} joined the room" in the call container. test these lines below:
      const userJoinedMessage = document.createElement('div');
      userJoinedMessage.className = 'user-joined-message';
      userJoinedMessage.textContent = `User ${userId} joined the room`;
      callContainer.appendChild(userJoinedMessage);
    }
    
    // Create a WebRTC peer connection
    function createPeerConnection(peerId) {
      const peerConnection = new RTCPeerConnection(iceServers);
      peerConnections[peerId] = peerConnection;
      
      // Add local tracks to the connection
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', event.candidate, roomId, userId, peerId);
        }
      };
      
      // Handle receiving remote streams
      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        
        // Check if we already have a video element for this peer
        const existingVideo = document.getElementById(`video-${peerId}`);
        if (!existingVideo) {
          addVideoStream(remoteStream, peerId);
        }
      };
      
      return peerConnection;
    }
    
    // Create and send an offer
    async function createOffer(peerId) {
      try {
        const peerConnection = peerConnections[peerId];
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('offer', offer, roomId, userId, peerId);
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }
    
    // Add a video stream to the grid
    function addVideoStream(stream, peerId) {
      // Create container for video and name tag
      const videoContainer = document.createElement('div');
      videoContainer.className = 'video-container';
      
      // Create video element
      const videoElement = document.createElement('video');
      videoElement.id = `video-${peerId}`;
      videoElement.srcObject = stream;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      
      // Create name tag
      const nameTag = document.createElement('div');
      nameTag.className = 'name-tag';
      nameTag.textContent = `User ${peerId.substring(0, 5)}`;
      
      // Add elements to container
      videoContainer.appendChild(videoElement);
      videoContainer.appendChild(nameTag);
      
      // Add container to grid
      videoGrid.appendChild(videoContainer);
    }
    
    // Copy room ID to clipboard
    function copyRoomId() {
      navigator.clipboard.writeText(roomId)
        .then(() => {
          alert('Room ID copied to clipboard!');
        })
        .catch(err => {
          console.error('Failed to copy room ID:', err);
        });
    }
    
    // Leave the current call
    function leaveRoom() {
      // Stop all tracks in the local stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      // Close all peer connections
      Object.values(peerConnections).forEach(connection => {
        if (connection) {
          connection.close();
        }
      });
      
      // Clear peer connections object
      peerConnections = {};
      
      // Reset UI
      callContainer.classList.add('hidden');
      joinContainer.classList.remove('hidden');
      
      // Remove all remote videos
      const videos = document.querySelectorAll('.video-container:not(:first-child)');
      videos.forEach(video => video.remove());
      
      // Reset controls
      isAudioMuted = false;
      isVideoOff = false;
      isScreenSharing = false;
      muteBtn.classList.remove('active');
      videoBtn.classList.remove('active');
      screenShareBtn.classList.remove('active');
      
      // Disconnect from the room
      socket.disconnect();
      
      // Reconnect socket for next call
      socket = io();
      setupSocketListeners();
    }
    
    // Toggle audio mute
    function toggleAudio() {
      isAudioMuted = !isAudioMuted;
      
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioMuted;
      });
      
      muteBtn.classList.toggle('active', isAudioMuted);
      muteBtn.querySelector('.material-icons').textContent = isAudioMuted ? 'mic_off' : 'mic';
    }
    
    // Toggle video on/off
    function toggleVideo() {
      isVideoOff = !isVideoOff;
      
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoOff;
      });
      
      videoBtn.classList.toggle('active', isVideoOff);
      videoBtn.querySelector('.material-icons').textContent = isVideoOff ? 'videocam_off' : 'videocam';
    }
    
    // Toggle screen sharing
    async function toggleScreenShare() {
      if (!isScreenSharing) {
        try {
          // Get screen sharing stream
          localScreenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true
          });
          
          // Replace video track in all peer connections
          const videoTrack = localScreenStream.getVideoTracks()[0];
          
          Object.values(peerConnections).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(videoTrack);
            }
          });
          
          // Replace local video track
          localVideo.srcObject = localScreenStream;
          
          // Add event listener for when screen sharing stops
          videoTrack.onended = () => {
            toggleScreenShare();
          };
          
          isScreenSharing = true;
          screenShareBtn.classList.add('active');
        } catch (error) {
          console.error('Error sharing screen:', error);
        }
      } else {
        // Stop screen sharing
        if (localScreenStream) {
          localScreenStream.getTracks().forEach(track => track.stop());
        }
        
        // Get original video track
        const videoTrack = localStream.getVideoTracks()[0];
        
        // Replace video track in all peer connections
        Object.values(peerConnections).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        // Replace local video track
        localVideo.srcObject = localStream;
        
        isScreenSharing = false;
        screenShareBtn.classList.remove('active');
      }
}



document.addEventListener('DOMContentLoaded', init);
