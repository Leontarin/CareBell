// WebRTCManager.js
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
    this.isSettingRemoteDesc   = false;
    this.onRemoteStream        = null;
    this.isDestroyed           = false;

    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ];
    
    this.rtcConfig = {
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };
  }

  async initialize(localStream, isInitiator = false) {
    if (this.isDestroyed) {
      console.warn('⚠️ Cannot initialize destroyed WebRTC manager');
      return false;
    }

    this.localStream = localStream;
    this.isInitiator = isInitiator;
    this.connectionAttempts++;

    console.log(`🚀 Initializing WebRTC connection (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})`);

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    
    this.connectionTimeout = setTimeout(() => {
      if (this.connectionAttempts < this.maxConnectionAttempts && this.onConnectionFailed && !this.isDestroyed) {
        console.log(`⏰ Connection timeout, triggering retry`);
        this.onConnectionFailed();
      }
    }, 20000); // Increased timeout to 20 seconds

    try {
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);
      
      // Add local stream tracks
      this.localStream.getTracks().forEach(track => {
        console.log(`📤 Adding ${track.kind} track to peer connection`);
        this.peerConnection.addTrack(track, this.localStream);
      });

      this.setupPeerConnectionHandlers();

      if (isInitiator) {
        // Longer delay for initiator to ensure everything is set up
        setTimeout(async () => {
          if (!this.isDestroyed && this.peerConnection && this.peerConnection.signalingState === 'stable' && !this.makingOffer) {
            console.log('🎯 Initiator creating initial offer after delay');
            await this.createOffer();
          }
        }, 1000); // Increased delay to 1 second
      }

      return true;
    } catch (error) {
      console.error('❌ Error initializing WebRTC connection:', error);
      return false;
    }
  }

  setupPeerConnectionHandlers() {
    if (!this.peerConnection || this.isDestroyed) return;

    this.peerConnection.ontrack = (event) => {
      if (this.isDestroyed) return;
      
      console.log(`📥 Track received from ${this.userId}:`, event.track.kind, event.track.enabled, event.track.readyState);
      
      try {
        // Use the stream from the event if available
        if (event.streams && event.streams[0]) {
          this._remoteStream = event.streams[0];
          console.log('🎥 Using stream from event for', this.userId, 'tracks:', event.streams[0].getTracks().length);
        } else {
          // Create new stream if needed
          if (!this._remoteStream) {
            this._remoteStream = new MediaStream();
            console.log('🆕 Created new remote stream for', this.userId);
          }
          this._remoteStream.addTrack(event.track);
          console.log('➕ Added track to remote stream for', this.userId, 'total tracks:', this._remoteStream.getTracks().length);
        }

        // Call the callback if provided
        if (this.onRemoteStream && !this.isDestroyed) {
          console.log('📞 Calling onRemoteStream callback for', this.userId);
          this.onRemoteStream(this._remoteStream);
        }

        // Set video element source as backup
        if (this.remoteVideoRef.current && !this.isDestroyed) {
          console.log('📺 Setting srcObject on video element for', this.userId);
          this.remoteVideoRef.current.srcObject = this._remoteStream;
          this.remoteVideoRef.current.volume = 1.0;
          this.remoteVideoRef.current.muted = false;
          this.remoteVideoRef.current.play().catch(e => {
            console.log("⚠️ Autoplay prevented:", e.message);
          });
        }
      } catch (error) {
        console.error('❌ Error handling track event:', error);
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (this.isDestroyed) return;
      
      if (event.candidate) {
        console.log(`🧊 Sending ICE candidate from ${this.userId} to room ${this.roomId}`);
        if (this.socket && this.socket.connected) {
          this.socket.emit('signal', {
            roomId: this.roomId,
            userId: this.userId,
            signal: {
              type: 'ice-candidate',
              candidate: event.candidate
            }
          });
        }
      } else {
        console.log(`✅ ICE gathering complete for ${this.userId}`);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.isDestroyed) return;
      
      const state = this.peerConnection.iceConnectionState;
      console.log(`🧊 ICE connection state changed to: ${state} for user ${this.userId}`);
      
      if (state === 'connected' || state === 'completed') {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.connectionAttempts = 0;
        console.log(`✅ WebRTC connection established with user ${this.userId}`);
      } else if (state === 'failed' || state === 'disconnected') {
        console.log(`❌ ICE connection ${state} with user ${this.userId}`);
        if (state === 'failed') {
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.restartIce();
            }
          }, 1000);
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.isDestroyed) return;
      
      const state = this.peerConnection.connectionState;
      console.log(`🔗 Connection state changed to: ${state} for user ${this.userId}`);
      
      if (state === 'connected') {
        this.connectionAttempts = 0;
        console.log(`✅ Peer connection fully established with user ${this.userId}`);
      } else if (state === 'failed' && this.onConnectionFailed) {
        console.log(`❌ Peer connection failed with user ${this.userId}`);
        setTimeout(() => {
          if (!this.isDestroyed && this.onConnectionFailed) {
            this.onConnectionFailed();
          }
        }, 500);
      }
    };

    this.peerConnection.onnegotiationneeded = async () => {
      if (this.isDestroyed || this.negotiationLock || this.makingOffer || this.isSettingRemoteDesc) {
        console.log('⚠️ Negotiation skipped - already in progress or destroyed');
        return;
      }
      
      if (this.peerConnection.signalingState !== 'stable') {
        console.log(`⚠️ Negotiation needed but connection not stable (${this.peerConnection.signalingState}), skipping`);
        return;
      }
      
      this.negotiationLock = true;
      this.makingOffer = true;
      
      try {
        console.log(`🤝 Negotiation needed for ${this.userId}, creating offer`);
        await this.createOffer();
      } catch (e) {
        console.error('❌ Negotiation error:', e);
      } finally {
        this.makingOffer = false;
        this.negotiationLock = false;
      }
    };
  }

  async restartIce() {
    if (this.isDestroyed) return;
    
    try {
      console.log('🔄 Restarting ICE connection');
      await this.peerConnection.restartIce();
    } catch (e) {
      console.error('❌ ICE restart error:', e);
      if (this.onConnectionFailed && !this.isDestroyed) {
        setTimeout(() => {
          if (!this.isDestroyed) {
            console.log('🔄 ICE restart failed, triggering connection retry');
            this.onConnectionFailed();
          }
        }, 2000);
      }
    }
  }

  async createOffer() {
    if (this.isDestroyed || !this.peerConnection) return false;
    
    if (this.peerConnection.signalingState !== 'stable') {
      console.log(`⚠️ Cannot create offer in state: ${this.peerConnection.signalingState}`);
      return false;
    }
    
    try {
      console.log(`🎯 Creating offer from ${this.userId} for room ${this.roomId}`);
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      
      console.log(`📤 Sending offer from ${this.userId} to room ${this.roomId}`);
      if (this.socket && this.socket.connected && !this.isDestroyed) {
        this.socket.emit('signal', {
          roomId: this.roomId,
          userId: this.userId,
          signal: { type: 'offer', sdp: offer }
        });
      }
      return true;
    } catch (error) {
      console.error('❌ Error creating offer:', error);
      return false;
    }
  }

  async handleSignal({ signal }) {
    if (this.isDestroyed || !this.peerConnection) return false;
    
    try {
      switch (signal.type) {
        case 'offer':          return await this.handleOffer(signal.sdp);
        case 'answer':         return await this.handleAnswer(signal.sdp);
        case 'ice-candidate':  return await this.handleIceCandidate(signal.candidate);
        default:
          console.log('❓ Unknown signal type:', signal.type);
          return false;
      }
    } catch (error) {
      console.error(`❌ Error handling ${signal.type} signal:`, error);
      return false;
    }
  }

  async handleOffer(offer) {
    if (this.isDestroyed) return false;
    
    console.log(`📥 Handling offer from another user, polite: ${this.polite}, making offer: ${this.makingOffer}, signaling state: ${this.peerConnection.signalingState}`);
    
    const offerDesc = typeof offer.sdp === 'string' ? offer : { type: 'offer', sdp: offer };
    
    // Perfect negotiation logic
    const readyForOffer = this.peerConnection.signalingState === 'stable' || this.peerConnection.signalingState === 'have-remote-offer';
    const offerCollision = !readyForOffer && this.makingOffer;
    
    this.ignoreOffer = !this.polite && offerCollision;
    
    console.log(`🤔 Offer handling - readyForOffer: ${readyForOffer}, offerCollision: ${offerCollision}, ignoreOffer: ${this.ignoreOffer}`);
    
    if (this.ignoreOffer) {
      console.log('🚫 Ignoring offer due to collision and impolite role');
      return false;
    }
    
    this.isSettingRemoteDesc = true;
    
    try {
      if (offerCollision && this.polite) {
        console.log('🔄 Rolling back due to collision (polite)');
        await this.peerConnection.setLocalDescription({ type: 'rollback' });
        this.makingOffer = false;
      }
      
      await this.peerConnection.setRemoteDescription(offerDesc);
      console.log('✅ Remote description set successfully');
      
      await this.processQueuedIceCandidates();
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      console.log(`📤 Sending answer from ${this.userId} to room ${this.roomId}`);
      if (this.socket && this.socket.connected && !this.isDestroyed) {
        this.socket.emit('signal', {
          roomId: this.roomId,
          userId: this.userId,
          signal: { type: 'answer', sdp: answer }
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error handling offer:', error);
      return false;
    } finally {
      this.isSettingRemoteDesc = false;
    }
  }

  async handleAnswer(answer) {
    if (this.isDestroyed) return false;
    
    // Check if we're expecting an answer
    if (this.peerConnection.signalingState !== 'have-local-offer') {
      console.log(`⚠️ Ignoring answer in state: ${this.peerConnection.signalingState}`);
      return false;
    }
    
    console.log(`📥 Processing answer from another user`);
    const answerDesc = typeof answer.sdp === 'string' ? answer : { type: 'answer', sdp: answer };
    
    this.isSettingRemoteDesc = true;
    
    try {
      await this.peerConnection.setRemoteDescription(answerDesc);
      await this.processQueuedIceCandidates();
      console.log('✅ Answer processed successfully');
      return true;
    } catch (error) {
      console.error('❌ Error processing answer:', error);
      return false;
    } finally {
      this.isSettingRemoteDesc = false;
      this.makingOffer = false;
    }
  }

  async handleIceCandidate(candidate) {
    if (this.isDestroyed) return false;
    
    try {
      if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
        await this.peerConnection.addIceCandidate(candidate);
        console.log('✅ ICE candidate added successfully');
      } else {
        console.log('📦 Queueing ICE candidate for later');
        this.queuedIceCandidates.push(candidate);
      }
      return true;
    } catch (e) {
      console.error('❌ Error adding ICE candidate:', e);
      return false;
    }
  }

  async processQueuedIceCandidates() {
    if (this.isDestroyed) return;
    
    while (this.queuedIceCandidates.length > 0 && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
      const candidate = this.queuedIceCandidates.shift();
      try {
        await this.peerConnection.addIceCandidate(candidate);
        console.log('✅ Processed queued ICE candidate');
      } catch (e) {
        console.error('❌ Queued ICE candidate error:', e);
      }
    }
  }

  getConnectionState() {
    if (!this.peerConnection || this.isDestroyed) return 'destroyed';
    return {
      connectionState: this.peerConnection.connectionState,
      iceConnectionState: this.peerConnection.iceConnectionState,
      signalingState: this.peerConnection.signalingState,
      attempts: this.connectionAttempts
    };
  }

  destroy() {
    if (this.isDestroyed) return;
    
    console.log('🧹 Destroying WebRTC manager for', this.userId);
    this.isDestroyed = true;
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this._remoteStream) {
      this._remoteStream.getTracks().forEach(t => t.stop());
      this._remoteStream = null;
    }
    
    this.queuedIceCandidates = [];
  }

  cleanup() {
    this.destroy();
  }
}

export { WebRTCManager };