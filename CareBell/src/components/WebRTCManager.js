// WebRTC Manager using native WebRTC APIs
class WebRTCManager {
  constructor(localVideoRef, remoteVideoRef, socket, roomId) {
    this.localVideoRef = localVideoRef;
    this.remoteVideoRef = remoteVideoRef;
    this.socket = socket;
    this.roomId = roomId;
    this.peerConnection = null;
    this.localStream = null;
    this.isInitiator = false;
    
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ];
  }

  async initialize(localStream, isInitiator = false) {
    this.localStream = localStream;
    this.isInitiator = isInitiator;
    
    try {
      // Create RTCPeerConnection
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.iceServers,
        iceCandidatePoolSize: 10,
      });

      // Add local stream tracks
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
        console.log('Received remote stream');
        const [remoteStream] = event.streams;
        if (this.remoteVideoRef.current) {
          this.remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate');
          this.socket.emit('signal', {
            roomId: this.roomId,
            signal: {
              type: 'ice-candidate',
              candidate: event.candidate
            }
          });
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection.connectionState);
      };

      // Handle ICE connection state changes
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection.iceConnectionState);
      };

      // If initiator, create offer
      if (this.isInitiator) {
        await this.createOffer();
      }

      return true;
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      throw error;
    }
  }

  async createOffer() {
    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      
      console.log('Sending offer');
      this.socket.emit('signal', {
        roomId: this.roomId,
        signal: {
          type: 'offer',
          sdp: offer
        }
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  async handleOffer(offer) {
    try {
      await this.peerConnection.setRemoteDescription(offer);
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('Sending answer');
      this.socket.emit('signal', {
        roomId: this.roomId,
        signal: {
          type: 'answer',
          sdp: answer
        }
      });
    } catch (error) {
      console.error('Error handling offer:', error);
      throw error;
    }
  }

  async handleAnswer(answer) {
    try {
      await this.peerConnection.setRemoteDescription(answer);
      console.log('Answer set successfully');
    } catch (error) {
      console.error('Error handling answer:', error);
      throw error;
    }
  }

  async handleIceCandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(candidate);
      console.log('ICE candidate added successfully');
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  async handleSignal(signalData) {
    const { signal } = signalData;
    
    switch (signal.type) {
      case 'offer':
        await this.handleOffer(signal.sdp);
        break;
      case 'answer':
        await this.handleAnswer(signal.sdp);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(signal.candidate);
        break;
      default:
        console.log('Unknown signal type:', signal.type);
    }
  }

  destroy() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}

export { WebRTCManager };
