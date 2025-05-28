// WebRTC Manager using native WebRTC APIs
class WebRTCManager {
  constructor(localVideoRef, remoteVideoRef, socket, roomId, userId) {
    this.localVideoRef = localVideoRef;
    this.remoteVideoRef = remoteVideoRef;
    this.socket = socket;
    this.roomId = roomId;
    this.userId = userId; // <-- add this
    this.peerConnection = null;
    this.localStream = null;
    this.isInitiator = false;
    this.iceCandidateQueue = []; // Queue for ICE candidates received before remote description
    
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ];
  }

  async initialize(localStream, isInitiator = false) {
    this.localStream = localStream;
    this.isInitiator = isInitiator;
    
    console.log(`Initializing WebRTC peer, isInitiator: ${isInitiator}`);
    
    try {
      // Create RTCPeerConnection
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.iceServers,
        iceCandidatePoolSize: 10,
      });

      console.log('RTCPeerConnection created');

      // Add local stream tracks
      this.localStream.getTracks().forEach(track => {
        console.log(`Adding local track: ${track.kind}`);
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Handle remote stream with enhanced track handling
      this.peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        console.log('Got remote track', event.track.kind, 'from remote peer');
        
        // We need to ensure the ref exists and attach the stream
        if (this.remoteVideoRef.current) {
          console.log('Setting remote stream to video element');
          this.remoteVideoRef.current.srcObject = remoteStream;
          
          console.log('Set remote video for remote peer, track type:', event.track.kind);
          
          // Ensure video plays
          this.remoteVideoRef.current.play().catch(err => {
            console.warn('Auto-play prevented for remote video:', err);
          });
        } else {
          console.error('remoteVideoRef.current is null - cannot set remote stream');
        }
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('signal', {
            roomId: this.roomId,
            userId: this.userId, // always include userId
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
      console.log(`Creating offer, current signaling state: ${this.peerConnection.signalingState}`);
      
      // Only create offer if we're in stable state
      if (this.peerConnection.signalingState !== 'stable') {
        console.warn(`Cannot create offer in state: ${this.peerConnection.signalingState}`);
        return false;
      }
      
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      console.log('Setting local description with offer');
      await this.peerConnection.setLocalDescription(offer);
      console.log('Sending offer');
      
      this.socket.emit('signal', {
        roomId: this.roomId,
        userId: this.userId,
        signal: {
          type: 'offer',
          sdp: offer
        }
      });
      return true;
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  async handleOffer(offer) {
    try {
      console.log(`Handling offer, current signaling state: ${this.peerConnection.signalingState}`);
      
      // Check if we're in the right state to handle an offer
      if (this.peerConnection.signalingState !== 'stable' && this.peerConnection.signalingState !== 'have-local-offer') {
        console.warn(`Cannot handle offer in state: ${this.peerConnection.signalingState}`);
        return false;
      }
      
      // If we already have a local offer and receive a remote offer, we need to handle collision
      if (this.peerConnection.signalingState === 'have-local-offer') {
        console.log('Offer collision detected, handling collision resolution');
        // Use polite/impolite pattern - the "polite" peer backs down
        if (!this.isInitiator) {
          console.log('Acting as polite peer, rolling back local offer');
          await this.peerConnection.setLocalDescription({type: 'rollback'});
        } else {
          console.log('Acting as impolite peer, ignoring remote offer');
          return false;
        }
      }
      
      console.log('Setting remote description with offer');
      await this.peerConnection.setRemoteDescription(offer);
      console.log('Creating answer');
      const answer = await this.peerConnection.createAnswer();
      console.log('Setting local description (answer)');
      await this.peerConnection.setLocalDescription(answer);
      console.log('Sending answer');
      this.socket.emit('signal', {
        roomId: this.roomId,
        userId: this.userId,
        signal: {
          type: 'answer',
          sdp: answer
        }
      });
      
      // Process any queued ICE candidates now that we have remote description
      while (this.iceCandidateQueue.length > 0) {
        const queuedCandidate = this.iceCandidateQueue.shift();
        try {
          await this.peerConnection.addIceCandidate(queuedCandidate);
          console.log('Queued ICE candidate added successfully after offer');
        } catch (error) {
          console.error('Error adding queued ICE candidate after offer:', error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error handling offer:', error);
      throw error;
    }
  }

  async handleAnswer(answer) {
    try {
      console.log(`Handling answer, current signaling state: ${this.peerConnection.signalingState}`);
      
      // Check if we're in the right state to handle an answer
      if (this.peerConnection.signalingState !== 'have-local-offer') {
        console.warn(`Cannot handle answer in state: ${this.peerConnection.signalingState}. Expected 'have-local-offer'`);
        return false;
      }
      
      console.log('Setting remote description with answer');
      await this.peerConnection.setRemoteDescription(answer);
      console.log('Answer set successfully');
      
      // Process any queued ICE candidates now that we have remote description
      while (this.iceCandidateQueue.length > 0) {
        const queuedCandidate = this.iceCandidateQueue.shift();
        try {
          await this.peerConnection.addIceCandidate(queuedCandidate);
          console.log('Queued ICE candidate added successfully after answer');
        } catch (error) {
          console.error('Error adding queued ICE candidate after answer:', error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error handling answer:', error);
      throw error;
    }
  }

  async handleIceCandidate(candidate) {
    try {
      console.log(`Adding ICE candidate, signaling state: ${this.peerConnection.signalingState}`);
      
      // Only add ICE candidates if we have a remote description
      if (this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(candidate);
        console.log('ICE candidate added successfully');
        
        // Process any queued candidates
        while (this.iceCandidateQueue.length > 0) {
          const queuedCandidate = this.iceCandidateQueue.shift();
          try {
            await this.peerConnection.addIceCandidate(queuedCandidate);
            console.log('Queued ICE candidate added successfully');
          } catch (error) {
            console.error('Error adding queued ICE candidate:', error);
          }
        }
        return true;
      } else {
        console.warn('Cannot add ICE candidate: no remote description set yet, queuing candidate');
        this.iceCandidateQueue.push(candidate);
        return true; // Return true since we queued it successfully
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
      // Don't throw for ICE candidate errors, just return false
      return false;
    }
  }

  async handleSignal(signalData) {
    const { signal } = signalData;
    
    try {
      console.log(`Processing signal type: ${signal.type}, current state: ${this.peerConnection.signalingState}`);
      
      switch (signal.type) {
        case 'offer':
          return await this.handleOffer(signal.sdp);
        case 'answer':
          return await this.handleAnswer(signal.sdp);
        case 'ice-candidate':
          return await this.handleIceCandidate(signal.candidate);
        default:
          console.log('Unknown signal type:', signal.type);
          return false;
      }
    } catch (error) {
      console.error('Error handling signal:', error);
      return false;
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
    // Clear ICE candidate queue
    this.iceCandidateQueue = [];
  }
}

export { WebRTCManager };
