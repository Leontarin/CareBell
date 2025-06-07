// WebRTCManager.js
// Removes localStream stoppage on destroy so local preview stays alive

class WebRTCManager {
  constructor(localVideoRef, remoteVideoRef, socket, roomId, userId, polite) {
    this.localVideoRef       = localVideoRef;
    this.remoteVideoRef      = remoteVideoRef;
    this.socket              = socket;
    this.roomId              = roomId;
    this.userId              = userId;
    this.polite              = polite;
    this.peerConnection      = null;
    this.localStream         = null;
    this._remoteStream       = null;
    this.queuedIceCandidates = [];
    this.onConnectionFailed  = null;
    this.connectionAttempts  = 0;
    this.maxConnectionAttempts = 3;
    this.connectionTimeout     = null;
    this.lastSignalTime        = 0;
    this.negotiationLock       = false;
    this.makingOffer           = false;
    this.ignoreOffer           = false;
    this.onRemoteStream        = null; // Callback for when remote stream is received

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

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    this.connectionTimeout = setTimeout(() => {
      if (this.connectionAttempts < this.maxConnectionAttempts && this.onConnectionFailed) {
        this.onConnectionFailed();
      }
    }, 15000);

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10
    });

    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    this.peerConnection.ontrack = (event) => {
      if (!this._remoteStream) {
        this._remoteStream = new MediaStream();
      }
      if (event.streams && event.streams[0]) {
        this._remoteStream = event.streams[0];
      } else {
        this._remoteStream.addTrack(event.track);
      }

      // Call the callback if provided
      if (this.onRemoteStream) {
        this.onRemoteStream(this._remoteStream);
      }

      if (this.remoteVideoRef.current) {
        this.remoteVideoRef.current.srcObject = this._remoteStream;
        this.remoteVideoRef.current.play().catch(e => {
          console.log("Autoplay prevented:", e.message);
        });
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
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

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state changed to: ${this.peerConnection.iceConnectionState} for user ${this.userId}`);
      if (this.peerConnection.iceConnectionState === 'connected') {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.connectionAttempts = 0;
        console.log(`WebRTC connection established with user ${this.userId}`);
      } else if (this.peerConnection.iceConnectionState === 'failed') {
        console.log(`ICE connection failed with user ${this.userId}, restarting ICE`);
        this.restartIce();
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state changed to: ${this.peerConnection.connectionState} for user ${this.userId}`);
      if (this.peerConnection.connectionState === 'connected') {
        this.connectionAttempts = 0;
        console.log(`Peer connection fully established with user ${this.userId}`);
      } else if (this.peerConnection.connectionState === 'failed' && this.onConnectionFailed) {
        console.log(`Peer connection failed with user ${this.userId}`);
        this.onConnectionFailed();
      }
    };

    this.peerConnection.onnegotiationneeded = async () => {
      if (this.negotiationLock) return;
      this.negotiationLock = true;
      try {
        this.makingOffer = true;
        await this.createOffer();
      } catch (e) {
        console.error('Negotiation error:', e);
      } finally {
        this.makingOffer = false;
        this.negotiationLock = false;
      }
    };

    if (isInitiator) {
      await this.createOffer();
    }

    return true;
  }

  async restartIce() {
    try {
      await this.peerConnection.restartIce();
    } catch (e) {
      console.error('ICE restart error:', e);
    }
  }

  async createOffer() {
    if (this.peerConnection.signalingState !== 'stable') return false;
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await this.peerConnection.setLocalDescription(offer);
    this.socket.emit('signal', {
      roomId: this.roomId,
      userId: this.userId,
      signal: { type: 'offer', sdp: offer }
    });
    return true;
  }

  async handleSignal({ signal }) {
    if (!this.peerConnection) return false;
    switch (signal.type) {
      case 'offer':          return this.handleOffer(signal.sdp);
      case 'answer':         return this.handleAnswer(signal.sdp);
      case 'ice-candidate':  return this.handleIceCandidate(signal.candidate);
      default:
        console.log('Unknown signal type:', signal.type);
        return false;
    }
  }

  async handleOffer(offer) {
    const offerDesc = typeof offer.sdp === 'string' ? offer : { type: 'offer', sdp: offer };
    const ready = !this.makingOffer && (
      this.peerConnection.signalingState === 'stable' ||
      this.peerConnection.signalingState === 'have-local-offer'
    );
    const collision = !ready;
    this.ignoreOffer = !this.polite && collision;
    if (this.ignoreOffer) return false;
    if (collision && this.polite) {
      await this.peerConnection.setLocalDescription({ type: 'rollback' });
    }
    await this.peerConnection.setRemoteDescription(offerDesc);
    await this.processQueuedIceCandidates();
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.socket.emit('signal', {
      roomId: this.roomId,
      userId: this.userId,
      signal: { type: 'answer', sdp: answer }
    });
    return true;
  }

  async handleAnswer(answer) {
    if (this.peerConnection.signalingState === 'stable') {
      await this.peerConnection.setLocalDescription({ type: 'rollback' });
      if (this.isInitiator) await this.createOffer();
      return false;
    }
    if (this.peerConnection.signalingState !== 'have-local-offer') return false;
    await this.peerConnection.setRemoteDescription(answer);
    await this.processQueuedIceCandidates();
    return true;
  }

  async handleIceCandidate(candidate) {
    try {
      if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
        await this.peerConnection.addIceCandidate(candidate);
      } else {
        this.queuedIceCandidates.push(candidate);
      }
      return true;
    } catch (e) {
      console.error('Error adding ICE candidate:', e);
      return false;
    }
  }

  async processQueuedIceCandidates() {
    while (this.queuedIceCandidates.length > 0 && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
      const c = this.queuedIceCandidates.shift();
      try {
        await this.peerConnection.addIceCandidate(c);
      } catch (e) {
        console.error('Queued ICE error:', e);
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

  cleanup() {
    this.destroy();
  }

  destroy() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    // do not stop this.localStream here
    if (this._remoteStream) {
      this._remoteStream.getTracks().forEach(t => t.stop());
      this._remoteStream = null;
    }
    this.queuedIceCandidates = [];
  }
}

export { WebRTCManager };
