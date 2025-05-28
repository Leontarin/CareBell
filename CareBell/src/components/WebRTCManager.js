// WebRTC Manager using native WebRTC APIs
class WebRTCManager {
  constructor(localVideoRef, remoteVideoRef, socket, roomId, userId, polite) {
    this.localVideoRef = localVideoRef;
    this.remoteVideoRef = remoteVideoRef;
    this.socket = socket;
    this.roomId = roomId;
    this.userId = userId;
    this.peerConnection = null;
    this.localStream = null;
    this.isInitiator = false;
    this.queuedIceCandidates = []; // Queue for ICE candidates received before remote description
    this.onConnectionFailed = null; // Callback for connection failures
    this.connectionAttempts = 0; // Track connection attempts
    this.maxConnectionAttempts = 3; // Maximum retry attempts
    this.connectionTimeout = null; // Timeout for connection attempts
    this.lastSignalTime = 0; // Track last signal timestamp for rate limiting
    this.negotiationLock = false;
    this.polite = polite; // use passed polite flag
    this.makingOffer = false;
    this.ignoreOffer = false;

    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ];
  }

  async initialize(localStream, isInitiator = false) {
    this.localStream = localStream;
    this.isInitiator = isInitiator;
    this.connectionAttempts++;

    console.log(`Initializing WebRTC peer (attempt ${this.connectionAttempts}), isInitiator: ${isInitiator}`);

    try {
      // Clear any existing timeout
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
      }

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        console.log('Connection timeout - taking too long to establish');
        if (this.connectionAttempts < this.maxConnectionAttempts) {
          console.log(`Will retry connection (attempt ${this.connectionAttempts + 1}/${this.maxConnectionAttempts})`);
          if (this.onConnectionFailed) {
            this.onConnectionFailed();
          }
        } else {
          console.log('Max connection attempts reached, giving up');
        }
      }, 15000); // 15 second timeout

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

        // Clear connection timeout on successful track
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }

        // We need to ensure the ref exists and attach the stream
        if (this.remoteVideoRef.current) {
          console.log('Setting remote stream to video element');
          this.remoteVideoRef.current.srcObject = remoteStream;

          console.log('Set remote video for remote peer, track type:', event.track.kind);

          // Attempt to play the video
          this.remoteVideoRef.current.play().catch(e => {
            console.log('Auto-play prevented for remote video:', e.message);
          });
        } else {
          console.warn('Remote video ref not available when track received');
        }
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Generated ICE candidate');
          this.socket.emit('signal', {
            roomId: this.roomId,
            userId: this.userId,
            signal: {
              type: 'ice-candidate',
              candidate: event.candidate
            }
          });
        }
      };

      // Handle ICE connection state changes with recovery
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection.iceConnectionState);

        if (this.peerConnection.iceConnectionState === 'connected') {
          console.log('ICE connection established successfully');
          // Clear timeout on successful connection
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          // Reset connection attempts on success
          this.connectionAttempts = 0;
        } else if (this.peerConnection.iceConnectionState === 'failed') {
          console.log('ICE connection failed, attempting restart...');
          this.restartIce();
        }
      };

      // Handle connection state changes with recovery
      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection.connectionState);

        if (this.peerConnection.connectionState === 'connected') {
          console.log('Peer connection established successfully');
          // Reset connection attempts on success
          this.connectionAttempts = 0;
        } else if (this.peerConnection.connectionState === 'failed') {
          console.log('Connection failed, will need peer recreation');
          // Emit a custom event that the parent component can listen to
          if (this.onConnectionFailed) {
            this.onConnectionFailed();
          }
        }
      };

      // Handle negotiation needed event
      this.peerConnection.onnegotiationneeded = async () => {
        if (this.negotiationLock) {
          console.log('Negotiation already in progress, skipping');
          return;
        }
        this.negotiationLock = true;
        try {
          this.makingOffer = true;
          await this.createOffer();
        } catch (e) {
          console.error('Negotiationneeded error:', e);
        } finally {
          this.makingOffer = false;
          this.negotiationLock = false;
        }
      };

      // If we're the initiator, create offer
      if (isInitiator) {
        await this.createOffer();
      }

      return true;
    } catch (error) {
      console.error('Error initializing WebRTC peer:', error);
      throw error;
    }
  }

  async restartIce() {
    try {
      console.log('Restarting ICE...');
      await this.peerConnection.restartIce();
    } catch (error) {
      console.error('Error restarting ICE:', error);
    }
  }

  async createOffer() {
    try {
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

  async handleSignal(signalData) {
    const { signal } = signalData;
    if (!this.peerConnection) {
      console.warn('handleSignal called but peerConnection is null');
      return false;
    }
    try {
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

  async handleOffer(offer) {
    try {
      const offerDesc = typeof offer.sdp === 'string' ? offer : { type: 'offer', sdp: offer };
      const readyForOffer = !this.makingOffer && (this.peerConnection.signalingState === 'stable' || this.peerConnection.signalingState === 'have-local-offer');
      const offerCollision = !readyForOffer;
      this.ignoreOffer = !this.polite && offerCollision;
      if (this.ignoreOffer) {
        console.warn('Ignoring offer due to collision and impolite role');
        return false;
      }
      if (offerCollision && this.polite) {
        console.log('Polite peer rolling back local offer');
        await this.peerConnection.setLocalDescription({ type: 'rollback' });
      }
      await this.peerConnection.setRemoteDescription(offerDesc);
      await this.processQueuedIceCandidates();
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.socket.emit('signal', {
        roomId: this.roomId,
        userId: this.userId,
        signal: {
          type: 'answer',
          sdp: answer
        }
      });
      return true;
    } catch (error) {
      console.error('Error handling offer:', error);
      return false;
    }
  }

  async handleAnswer(answer) {
    try {
      console.log(`Handling answer, current signaling state: ${this.peerConnection.signalingState}`);

      // If in stable, this is a negotiation collision. Rollback and re-negotiate.
      if (this.peerConnection.signalingState === 'stable') {
        console.warn("Received answer in 'stable' state. Rolling back and re-negotiating.");
        await this.peerConnection.setLocalDescription({ type: 'rollback' });
        if (this.isInitiator) {
          await this.createOffer();
        }
        return false;
      }

      // Normal case: only handle answer in 'have-local-offer'
      if (this.peerConnection.signalingState !== 'have-local-offer') {
        console.warn(`Cannot handle answer in state: ${this.peerConnection.signalingState}. Expected 'have-local-offer'`);
        return false;
      }

      console.log('Setting remote description with answer');
      await this.peerConnection.setRemoteDescription(answer);

      // Process any queued ICE candidates now that we have remote description
      await this.processQueuedIceCandidates();

      console.log('Answer set successfully');
      return true;
    } catch (error) {
      console.error('Error handling answer:', error);
      throw error;
    }
  }

  async handleIceCandidate(candidate) {
    try {
      if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
        await this.peerConnection.addIceCandidate(candidate);
        return true;
      } else {
        this.queuedIceCandidates.push(candidate);
        return true;
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
      return false;
    }
  }

  async processQueuedIceCandidates() {
    while (this.queuedIceCandidates.length > 0 && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
      const candidate = this.queuedIceCandidates.shift();
      try {
        await this.peerConnection.addIceCandidate(candidate);
      } catch (e) {
        console.error('Error adding queued ICE candidate:', e);
      }
    }
  }

  getConnectionState() {
    if (!this.peerConnection) return 'no-peer';
    return {
      connectionState: this.peerConnection.connectionState,
      iceConnectionState: this.peerConnection.iceConnectionState,
      signalingState: this.peerConnection.signalingState,
      attempts: this.connectionAttempts
    };
  }

  destroy() {
    // Clear any timeouts
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    // Clear queued ICE candidates
    this.queuedIceCandidates = [];

    console.log('WebRTCManager destroyed and cleaned up');
  }
}

export { WebRTCManager };
