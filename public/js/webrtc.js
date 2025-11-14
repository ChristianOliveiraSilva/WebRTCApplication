const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const joinBtn = document.getElementById('joinBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const roomInput = document.getElementById('roomInput');

let localStream = null;
let peerConnection = null;
let currentRoom = null;

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

joinBtn.addEventListener('click', () => {
  const roomId = roomInput.value || 'room1';
  currentRoom = roomId;
  socket.emit('join-room', roomId);
  joinBtn.disabled = true;
  startBtn.disabled = false;
});

startBtn.addEventListener('click', async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    localVideo.srcObject = localStream;
    
    createPeerConnection();
    
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    console.error('Error accessing media devices:', error);
  }
});

stopBtn.addEventListener('click', () => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    localVideo.srcObject = null;
  }
  
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  remoteVideo.srcObject = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;
});

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);
  
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', {
        candidate: event.candidate,
        room: currentRoom
      });
    }
  };
  
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };
}

socket.on('user-joined', async (userId) => {
  if (peerConnection && localStream) {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      socket.emit('offer', {
        offer: offer,
        room: currentRoom
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }
});

socket.on('offer', async (data) => {
  if (!peerConnection && localStream) {
    createPeerConnection();
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }
  
  if (peerConnection) {
    try {
      await peerConnection.setRemoteDescription(data.offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      socket.emit('answer', {
        answer: answer,
        room: currentRoom
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }
});

socket.on('answer', async (data) => {
  if (peerConnection) {
    try {
      await peerConnection.setRemoteDescription(data.answer);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }
});

socket.on('ice-candidate', async (data) => {
  if (peerConnection) {
    try {
      await peerConnection.addIceCandidate(data.candidate);
    } catch (error) {
      console.error('Error adding ice candidate:', error);
    }
  }
});

