const socket = io()                                    // conecta ao servidor via Socket.IO
const localVideo = document.getElementById('localVideo')
const remoteVideo = document.getElementById('remoteVideo')
const joinBtn = document.getElementById('joinBtn')
const startBtn = document.getElementById('startBtn')
const stopBtn = document.getElementById('stopBtn')
const roomInput = document.getElementById('roomInput')

let localStream = null                                 // stream local de vídeo/áudio
let peerConnection = null                               // RTCPeerConnection ativo
let currentRoom = null                                  // sala em que o usuário entrou

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // STUN para descobrir IP público
}

joinBtn.addEventListener('click', () => {
  const roomId = roomInput.value || 'room1'             // pega sala ou usa padrão
  currentRoom = roomId

  createPeerConnection()                                // cria peer connection
  socket.emit('join-room', roomId)                      // avisa ao servidor que entrou na sala

  joinBtn.disabled = true                               // trava o botão
  startBtn.disabled = false
})

startBtn.addEventListener('click', async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })  // captura webcam/microfone

  localVideo.srcObject = localStream // mostra vídeo local

  localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream)) // adiciona tracks à conexão P2P (dispara renegociação)

  startBtn.disabled = true
  stopBtn.disabled = false
})

stopBtn.addEventListener('click', () => {
  if (localStream) {                                    // para webcam/microfone
    localStream.getTracks().forEach(t => t.stop())
    localStream = null
    localVideo.srcObject = null
  }

  if (peerConnection) {                                 // fecha conexão P2P
    peerConnection.close()
    peerConnection = null
  }

  remoteVideo.srcObject = null                          // limpa vídeo remoto
  startBtn.disabled = false
  stopBtn.disabled = true
})

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config)        // cria a conexão WebRTC com STUN

  peerConnection.onicecandidate = e => {                // quando o ICE encontra um endereço possível
    if (e.candidate) {
      socket.emit('ice-candidate', {                    // envia para o outro peer
        candidate: e.candidate,
        room: currentRoom
      })
    }
  }

  peerConnection.ontrack = e => {                       // quando o outro peer envia vídeo/áudio
    remoteVideo.srcObject = e.streams[0]                // mostra no vídeo remoto
  }

  peerConnection.onnegotiationneeded = async () => {    // dispara quando precisa criar um offer
    try {
      const offer = await peerConnection.createOffer()  // cria a oferta SDP
      await peerConnection.setLocalDescription(offer)   // define como descrição local

      socket.emit('offer', {                            // envia offer para a sala
        offer: offer,
        room: currentRoom
      })
    } catch (err) {}
  }
}

socket.on('user-joined', async () => {                  // outro usuário entrou
  if (!peerConnection) createPeerConnection()

  if (localStream) {                                    // garante que as tracks locais estão adicionadas
    localStream.getTracks().forEach(t => {
      if (!peerConnection.getSenders().find(s => s.track === t)) {
        peerConnection.addTrack(t, localStream)
      }
    })
  }
})

socket.on('offer', async data => {                      // recebendo offer do outro peer
  if (!peerConnection) createPeerConnection()

  if (localStream) {                                    // adiciona tracks locais se ainda não estiverem lá
    localStream.getTracks().forEach(t => {
      if (!peerConnection.getSenders().find(s => s.track === t)) {
        peerConnection.addTrack(t, localStream)
      }
    })
  }

  await peerConnection.setRemoteDescription(data.offer) // define a oferta remota

  const answer = await peerConnection.createAnswer()    // cria answer
  await peerConnection.setLocalDescription(answer)      // define a answer local

  socket.emit('answer', {                               // envia a answer para o outro peer
    answer: answer,
    room: currentRoom
  })
})

socket.on('answer', async data => {                     // recebendo answer
  if (!peerConnection) return
  await peerConnection.setRemoteDescription(data.answer)
})

socket.on('ice-candidate', async data => {              // recebendo ICE candidate do outro peer
  if (!peerConnection) return
  try {
    await peerConnection.addIceCandidate(data.candidate)
  } catch (e) {}
})
