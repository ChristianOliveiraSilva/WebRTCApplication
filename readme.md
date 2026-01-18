Fluxo completo resumido

A entra → cria RTCPeerConnection
A pega câmera/microfone
A cria offer
A envia offer pelo WebSocket para B
B cria answer
A e B trocam ICE candidates
ICE tenta criar rota
STUN tenta revelar IP público
Se falhar, TURN faz relay
Quando ICE conclui → conexão P2P criada
Tracks fluem P2P
DataChannel opcional flui P2P


https://www.youtube.com/watch?v=WmR9IMUD_CY

https://www.techtarget.com/rms/onlineimages/how_webrtc_works-f.png