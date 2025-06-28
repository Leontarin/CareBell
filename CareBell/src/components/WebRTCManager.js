// CareBell/src/components/WebRTCManager.js
import { P2P_CONFIG } from '../shared/config';

class WebRTCManager {
  constructor(localVideoRef, remoteVideoRef, denoSignaling, roomId, userId, targetUserId, polite) {
    this.localVideoRef       = localVideoRef;
    this.remoteVideoRef      = remoteVideoRef;
    this.denoSignaling       = denoSignaling;  // NEW: Deno signaling client
    this.roomId              = roomId;
    this.userId              = userId;
    this.targetUserId        = targetUserId; // NEW: specific peer we're connecting to
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
    
    // P2P specific properties
    this.connectionState       = 'new';
    this.dataChannel          = null;
    this.onConnectionEstablished = null;

    // Use the updated RTC config from P2P_CONFIG
    this.rtcConfig = P2P_CONFIG.RTC_CONFIG;

    // P2P Quality Monitoring
    this.connectionQuality = {
      latency: 0,
      packetLoss: 0,
      bandwidth: { up: 0, down: 0 },
      lastUpdate: Date.now()
    };
    
    this.qualityMonitorInterval = null;
  }

  async initialize(localStream, isInitiator = false) {
    if (this.isDestroyed) {
      console.warn('⚠️ Cannot initialize destroyed WebRTC manager');
      return false;
    }

    this.localStream = localStream;
    this.isInitiator = isInitiator;
    this.connectionAttempts++;

    console.log(`🚀 Initializing P2P connection to ${this.targetUserId} (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})`);

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    
    this.connectionTimeout = setTimeout(() => {
      if (this.connectionAttempts < this.maxConnectionAttempts && this.onConnectionFailed && !this.isDestroyed) {
        console.log(`⏰ P2P connection timeout with ${this.targetUserId}, triggering retry`);
        this.onConnectionFailed();
      }
    }, P2P_CONFIG.CONNECTION_TIMEOUT);

    try {
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);
      
      // Add local stream tracks
      this.localStream.getTracks().forEach(track => {
        console.log(`📤 Adding ${track.kind} track to P2P connection with ${this.targetUserId}`);
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Create data channel for P2P messaging (optional)
      if (isInitiator) {
        this.dataChannel = this.peerConnection.createDataChannel('p2p-channel', {
          ordered: true
        });
        this.setupDataChannel(this.dataChannel);
      }

      this.setupPeerConnectionHandlers();
      
      if (isInitiator) {
        // Minimal delay for collision prevention
        const delay = 100 + Math.random() * 100; // 100-200ms delay
        setTimeout(async () => {
          if (!this.isDestroyed && this.peerConnection && this.peerConnection.signalingState === 'stable' && !this.makingOffer) {
            console.log(`🎯 P2P Initiator creating offer for ${this.targetUserId}`);
            await this.createOffer();
          }
        }, delay);
      }

      return true;
    } catch (error) {
      console.error(`❌ Error initializing P2P connection with ${this.targetUserId}:`, error);
      return false;
    }
  }

 setupDataChannel(channel) {
  channel.onopen = () => {
    console.log(`📡 Data channel opened with ${this.targetUserId}`);
  };

  channel.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log(`💬 Received P2P message from ${this.targetUserId}:`, data);
      
      // Handle audio mute state messages
      if (data.type === 'audio-mute-state' && this.onMuteStateReceived) {
        this.onMuteStateReceived(data.userId, data.isMuted);
      }
    } catch (error) {
      console.error('Error parsing P2P message:', error);
    }
  };

  channel.onclose = () => {
    console.log(`📡 Data channel closed with ${this.targetUserId}`);
  };
}
  sendP2PMessage(message) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'p2p-message',
        from: this.userId,
        message: message,
        timestamp: Date.now()
      }));
      return true;
    }
    return false;
  }

  setupPeerConnectionHandlers() {
    if (!this.peerConnection || this.isDestroyed) return;

    // Handle incoming data channels
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      console.log(`📡 Received data channel from ${this.targetUserId}`);
      this.dataChannel = channel;
      this.setupDataChannel(channel);
    };

    this.peerConnection.ontrack = (event) => {
      if (this.isDestroyed) return;
      
      console.log(`📥 P2P Track received from ${this.targetUserId}:`, event.track.kind, event.track.enabled, event.track.readyState);
      
      try {
        if (event.streams && event.streams[0]) {
          this._remoteStream = event.streams[0];
          console.log(`🎥 Using P2P stream from ${this.targetUserId}, tracks:`, event.streams[0].getTracks().length);
        } else {
          if (!this._remoteStream) {
            this._remoteStream = new MediaStream();
            console.log(`🆕 Created new P2P remote stream for ${this.targetUserId}`);
          }
          this._remoteStream.addTrack(event.track);
          console.log(`➕ Added track to P2P remote stream for ${this.targetUserId}, total tracks:`, this._remoteStream.getTracks().length);
        }

        if (this.onRemoteStream && !this.isDestroyed) {
          console.log(`📞 Calling P2P onRemoteStream callback for ${this.targetUserId}`);
          this.onRemoteStream(this._remoteStream);
        }

        if (this.remoteVideoRef.current && !this.isDestroyed) {
          console.log(`📺 Setting P2P srcObject on video element for ${this.targetUserId}`);
          this.remoteVideoRef.current.srcObject = this._remoteStream;
          this.remoteVideoRef.current.volume = 1.0;
          this.remoteVideoRef.current.muted = false;
          this.remoteVideoRef.current.play().catch(e => {
            console.log("⚠️ P2P Autoplay prevented:", e.message);
          });
        }
      } catch (error) {
        console.error(`❌ Error handling P2P track event from ${this.targetUserId}:`, error);
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (this.isDestroyed) return;
      
      if (event.candidate) {
        console.log(`🧊 Sending P2P ICE candidate to ${this.targetUserId} via Deno signaling`);
        if (this.denoSignaling) {
          this.denoSignaling.sendIceCandidate(this.targetUserId, event.candidate);
        }
      } else {
        console.log(`✅ P2P ICE gathering complete for ${this.targetUserId}`);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.isDestroyed) return;
      
      const state = this.peerConnection.iceConnectionState;
      console.log(`🧊 P2P ICE connection state changed to: ${state} with ${this.targetUserId}`);
      
      if (state === 'connected' || state === 'completed') {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.connectionAttempts = 0;
        this.connectionState = 'connected';
        console.log(`✅ P2P WebRTC connection established with ${this.targetUserId}`);
        
        // Start quality monitoring
        this.startQualityMonitoring();
        
        if (this.onConnectionEstablished) {
          this.onConnectionEstablished(this.targetUserId);
        }
      } else if (state === 'failed' || state === 'disconnected') {
        console.log(`❌ P2P ICE connection ${state} with ${this.targetUserId}`);
        this.connectionState = state;
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
      console.log(`🔗 P2P Connection state changed to: ${state} with ${this.targetUserId}`);
      
      if (state === 'connected') {
        this.connectionAttempts = 0;
        this.connectionState = 'connected';
        console.log(`✅ P2P Peer connection fully established with ${this.targetUserId}`);
      } else if (state === 'failed' && this.onConnectionFailed) {
        console.log(`❌ P2P Peer connection failed with ${this.targetUserId}`);
        this.connectionState = 'failed';
        setTimeout(() => {
          if (!this.isDestroyed && this.onConnectionFailed) {
            this.onConnectionFailed();
          }
        }, 500);
      }
    };

   this.peerConnection.onnegotiationneeded = async () => {
  if (this.isDestroyed || this.negotiationLock || this.makingOffer || this.isSettingRemoteDesc) {
    console.log('⚠️ P2P Negotiation skipped - already in progress or destroyed');
    return;
  }
  
  if (this.peerConnection.signalingState !== 'stable') {
    console.log(`⚠️ P2P Negotiation needed but connection not stable (${this.peerConnection.signalingState}), skipping`);
    return;
  }
  
  // Add a small delay for the non-initiator to reduce offer collisions
  if (!this.isInitiator) {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    // Check again if still needed
    if (this.peerConnection.signalingState !== 'stable' || this.makingOffer || this.isDestroyed) {
      return;
    }
  }
  
  this.negotiationLock = true;
  this.makingOffer = true;
  
  try {
    console.log(`🤝 P2P Negotiation needed for ${this.targetUserId}, creating offer`);
    await this.createOffer();
  } catch (e) {
    console.error(`❌ P2P Negotiation error with ${this.targetUserId}:`, e);
  } finally {
    this.makingOffer = false;
    this.negotiationLock = false;
  }
};
  }

  async restartIce() {
    if (this.isDestroyed) return;
    
    try {
      console.log(`🔄 Restarting P2P ICE connection with ${this.targetUserId}`);
      await this.peerConnection.restartIce();
    } catch (e) {
      console.error(`❌ P2P ICE restart error with ${this.targetUserId}:`, e);
      if (this.onConnectionFailed && !this.isDestroyed) {
        setTimeout(() => {
          if (!this.isDestroyed) {
            console.log(`🔄 P2P ICE restart failed with ${this.targetUserId}, triggering connection retry`);
            this.onConnectionFailed();
          }
        }, 2000);
      }
    }
  }

  async createOffer() {
    if (this.isDestroyed || !this.peerConnection) return false;
    
    if (this.peerConnection.signalingState !== 'stable') {
      console.log(`⚠️ Cannot create P2P offer in state: ${this.peerConnection.signalingState}`);
      return false;
    }
    
    try {
      console.log(`🎯 Creating P2P offer for ${this.targetUserId}`);
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      
      console.log(`📤 Sending P2P offer to ${this.targetUserId} via Deno signaling`);
      if (this.denoSignaling && !this.isDestroyed) {
        this.denoSignaling.sendOffer(this.targetUserId, offer);
      }
      return true;
    } catch (error) {
      console.error(`❌ Error creating P2P offer for ${this.targetUserId}:`, error);
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
          console.log(`❓ Unknown P2P signal type: ${signal.type}`);
          return false;
      }
    } catch (error) {
      console.error(`❌ Error handling P2P ${signal.type} signal from ${this.targetUserId}:`, error);
      return false;
    }
  }

  async handleOffer(offer) {
    if (this.isDestroyed) return false;
    
    console.log(`📥 Handling P2P offer from ${this.targetUserId}, polite: ${this.polite}, making offer: ${this.makingOffer}`);
    
    const offerDesc = typeof offer.sdp === 'string' ? offer : { type: 'offer', sdp: offer };
    
    // Perfect negotiation logic for P2P
    const readyForOffer = this.peerConnection.signalingState === 'stable' || this.peerConnection.signalingState === 'have-remote-offer';
    const offerCollision = !readyForOffer && this.makingOffer;
    
    this.ignoreOffer = !this.polite && offerCollision;
    
    console.log(`🤔 P2P Offer handling - readyForOffer: ${readyForOffer}, offerCollision: ${offerCollision}, ignoreOffer: ${this.ignoreOffer}`);
    
    if (this.ignoreOffer) {
      console.log(`🚫 Ignoring P2P offer from ${this.targetUserId} due to collision and impolite role`);
      return false;
    }
    
    this.isSettingRemoteDesc = true;
    
    try {
      if (offerCollision && this.polite) {
        console.log(`🔄 Rolling back P2P offer due to collision (polite) with ${this.targetUserId}`);
        await this.peerConnection.setLocalDescription({ type: 'rollback' });
        this.makingOffer = false;
      }
      
      await this.peerConnection.setRemoteDescription(offerDesc);
      console.log(`✅ P2P Remote description set successfully for ${this.targetUserId}`);
      
      await this.processQueuedIceCandidates();
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      console.log(`📤 Sending P2P answer to ${this.targetUserId} via Deno signaling`);
      if (this.denoSignaling && !this.isDestroyed) {
        this.denoSignaling.sendAnswer(this.targetUserId, answer);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error handling P2P offer from ${this.targetUserId}:`, error);
      return false;
    } finally {
      this.isSettingRemoteDesc = false;
    }
  }

  async handleAnswer(answer) {
    if (this.isDestroyed) return false;
    
    if (this.peerConnection.signalingState !== 'have-local-offer') {
      console.log(`⚠️ Ignoring P2P answer from ${this.targetUserId} in state: ${this.peerConnection.signalingState}`);
      return false;
    }
    
    console.log(`📥 Processing P2P answer from ${this.targetUserId}`);
    const answerDesc = typeof answer.sdp === 'string' ? answer : { type: 'answer', sdp: answer };
    
    this.isSettingRemoteDesc = true;
    
    try {
      await this.peerConnection.setRemoteDescription(answerDesc);
      await this.processQueuedIceCandidates();
      console.log(`✅ P2P Answer processed successfully from ${this.targetUserId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error processing P2P answer from ${this.targetUserId}:`, error);
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
        console.log(`✅ P2P ICE candidate added successfully from ${this.targetUserId}`);
      } else {
        console.log(`📦 Queueing P2P ICE candidate from ${this.targetUserId} for later`);
        this.queuedIceCandidates.push(candidate);
      }
      return true;
    } catch (e) {
      console.error(`❌ Error adding P2P ICE candidate from ${this.targetUserId}:`, e);
      return false;
    }
  }

  async processQueuedIceCandidates() {
    if (this.isDestroyed) return;
    
    while (this.queuedIceCandidates.length > 0 && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
      const candidate = this.queuedIceCandidates.shift();
      try {
        await this.peerConnection.addIceCandidate(candidate);
        console.log(`✅ Processed queued P2P ICE candidate from ${this.targetUserId}`);
      } catch (e) {
        console.error(`❌ Queued P2P ICE candidate error from ${this.targetUserId}:`, e);
      }
    }
  }

  startQualityMonitoring() {
    this.qualityMonitorInterval = setInterval(async () => {
      if (this.peerConnection && this.peerConnection.connectionState === 'connected') {
        try {
          const stats = await this.peerConnection.getStats();
          this.updateConnectionQuality(stats);
        } catch (error) {
          console.warn('⚠️ Failed to get P2P connection stats:', error);
        }
      }
    }, 5000);
  }

  updateConnectionQuality(stats) {
    let bytesReceived = 0;
    let bytesSent = 0;
    let packetsLost = 0;
    let packetsReceived = 0;
    let currentRoundTripTime = 0;

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        bytesReceived += report.bytesReceived || 0;
        packetsLost += report.packetsLost || 0;
        packetsReceived += report.packetsReceived || 0;
      } else if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
        bytesSent += report.bytesSent || 0;
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        currentRoundTripTime = report.currentRoundTripTime || 0;
      }
    });

    const now = Date.now();
    const timeDiff = (now - this.connectionQuality.lastUpdate) / 1000;

    if (timeDiff > 0) {
      this.connectionQuality = {
        latency: Math.round(currentRoundTripTime * 1000),
        packetLoss: packetsReceived > 0 ? Math.round((packetsLost / (packetsLost + packetsReceived)) * 100) : 0,
        bandwidth: {
          up: Math.round((bytesSent * 8) / timeDiff / 1024),
          down: Math.round((bytesReceived * 8) / timeDiff / 1024)
        },
        lastUpdate: now
      };

      console.log(`📊 P2P Quality with ${this.targetUserId}:`, {
        latency: `${this.connectionQuality.latency}ms`,
        packetLoss: `${this.connectionQuality.packetLoss}%`,
        bandwidth: `↑${this.connectionQuality.bandwidth.up}kbps ↓${this.connectionQuality.bandwidth.down}kbps`
      });

      if (this.onQualityChange) {
        this.onQualityChange(this.connectionQuality);
      }
    }
  }

  getConnectionQuality() {
    return this.connectionQuality;
  }

  getConnectionState() {
    if (!this.peerConnection || this.isDestroyed) return 'destroyed';
    return {
      connectionState: this.peerConnection.connectionState,
      iceConnectionState: this.peerConnection.iceConnectionState,
      signalingState: this.peerConnection.signalingState,
      attempts: this.connectionAttempts,
      targetUser: this.targetUserId,
      p2pState: this.connectionState,
      quality: this.connectionQuality
    };
  }

  destroy() {
    if (this.isDestroyed) return;
    
    console.log(`🧹 Destroying P2P WebRTC manager for ${this.targetUserId}`);
    this.isDestroyed = true;
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.qualityMonitorInterval) {
      clearInterval(this.qualityMonitorInterval);
      this.qualityMonitorInterval = null;
    }
    
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
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