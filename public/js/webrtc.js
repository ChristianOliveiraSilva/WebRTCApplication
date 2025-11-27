const socket = io()
const localVideo = document.getElementById('localVideo')
const remoteVideo = document.getElementById('remoteVideo')
const joinBtn = document.getElementById('joinBtn')
const startBtn = document.getElementById('startBtn')
const stopBtn = document.getElementById('stopBtn')
const roomInput = document.getElementById('roomInput')

let localStream = null
let peerConnection = null
let currentRoom = null

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
}

joinBtn.addEventListener('click', () => {
  const roomId = roomInput.value || 'room1'
  currentRoom = roomId

  createPeerConnection()
  socket.emit('join-room', roomId)

  joinBtn.disabled = true
  startBtn.disabled = false
})

startBtn.addEventListener('click', async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  localVideo.srcObject = localStream

  localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream))

  startBtn.disabled = true
  stopBtn.disabled = false
})

stopBtn.addEventListener('click', () => {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop())
    localStream = null
    localVideo.srcObject = null
  }

  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }

  remoteVideo.srcObject = null
  startBtn.disabled = false
  stopBtn.disabled = true
})

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config)

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('ice-candidate', {
        candidate: e.candidate,
        room: currentRoom
      })
    }
  }

  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0]
  }

  peerConnection.onnegotiationneeded = async () => {
    try {
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      socket.emit('offer', {
        offer: offer,
        room: currentRoom
      })
    } catch (err) {}
  }
}

socket.on('user-joined', async () => {
  if (!peerConnection) createPeerConnection()

  if (localStream) {
    localStream.getTracks().forEach(t => {
      if (!peerConnection.getSenders().find(s => s.track === t)) {
        peerConnection.addTrack(t, localStream)
      }
    })
  }
})

socket.on('offer', async data => {
  if (!peerConnection) createPeerConnection()

  if (localStream) {
    localStream.getTracks().forEach(t => {
      if (!peerConnection.getSenders().find(s => s.track === t)) {
        peerConnection.addTrack(t, localStream)
      }
    })
  }

  await peerConnection.setRemoteDescription(data.offer)

  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)

  socket.emit('answer', {
    answer: answer,
    room: currentRoom
  })
})

socket.on('answer', async data => {
  if (!peerConnection) return
  await peerConnection.setRemoteDescription(data.answer)
})

socket.on('ice-candidate', async data => {
  if (!peerConnection) return
  try {
    await peerConnection.addIceCandidate(data.candidate)
  } catch (e) {}
})
