// CareBell/src/components/DenoP2PSignaling.js
import { P2P_CONFIG } from '../shared/config';

class DenoP2PSignaling {
  constructor(localVideoRef, remoteVideoRef, denoSignaling, roomId, userId, targetUserId, polite) {
    this.localVideoRef       = localVideoRef;
    this.remoteVideoRef      = remoteVideoRef;
    this.denoSignaling       = denoSignaling;
    this.roomId              = roomId;
    this.userId              = userId;
    this.targetUserId        = targetUserId;
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
      return false;
    }

    this.localStream = localStream;
    this.isInitiator = isInitiator;
    this.connectionAttempts++;

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    
    this.connectionTimeout = setTimeout(() => {
      if (this.connectionAttempts < this.maxConnectionAttempts && this.onConnectionFailed && !this.isDestroyed) {
        this.onConnectionFailed();
      }
    }, P2P_CONFIG.CONNECTION_TIMEOUT);

    try {
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);
      
      // Add local stream tracks
      this.localStream.getTracks().forEach(track => {
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
            await this.createOffer();
          }
        }, delay);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  setupDataChannel(channel) {
    channel.onopen = () => {
      // Data channel opened
    };

    channel.onmessage = (event) => {
      // Handle P2P messages
    };

    channel.onclose = () => {
      // Data channel closed
    };
  }

  sendP2PMessage(message) {
    // Check if data channel is ready
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({
          type: 'p2p-message',
          from: this.userId,
          message: message,
          timestamp: Date.now()
        }));
        return true;
      } catch (error) {
        return false;
      }
    } else {
      return false;
    }
  }

  setupPeerConnectionHandlers() {
    if (!this.peerConnection || this.isDestroyed) return;

    // Handle incoming data channels
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      this.dataChannel = channel;
      this.setupDataChannel(channel);
    };

    this.peerConnection.ontrack = (event) => {
      if (this.isDestroyed) return;
      
      try {
        if (event.streams && event.streams[0]) {
          this._remoteStream = event.streams[0];
        } else {
          if (!this._remoteStream) {
            this._remoteStream = new MediaStream();
          }
          this._remoteStream.addTrack(event.track);
        }

        if (this.onRemoteStream && !this.isDestroyed) {
          this.onRemoteStream(this._remoteStream);
        }

        if (this.remoteVideoRef.current && !this.isDestroyed) {
          this.remoteVideoRef.current.srcObject = this._remoteStream;
          this.remoteVideoRef.current.volume = 1.0;
          this.remoteVideoRef.current.muted = false;
          this.remoteVideoRef.current.play().catch(e => {
            // Autoplay prevented
          });
        }
      } catch (error) {
        // Silent error handling
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (this.isDestroyed) return;
      
      if (event.candidate) {
        if (this.denoSignaling) {
          this.denoSignaling.sendIceCandidate(this.targetUserId, event.candidate);
        }
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.isDestroyed) return;
      
      const state = this.peerConnection.iceConnectionState;
      
      if (state === 'connected' || state === 'completed') {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.connectionAttempts = 0;
        this.connectionState = 'connected';
        
        // Start quality monitoring
        this.startQualityMonitoring();
        
        if (this.onConnectionEstablished) {
          this.onConnectionEstablished(this.targetUserId);
        }
      } else if (state === 'failed' || state === 'disconnected') {
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
      
      if (state === 'connected') {
        this.connectionAttempts = 0;
        this.connectionState = 'connected';
      } else if (state === 'failed' && this.onConnectionFailed) {
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
        return;
      }
      
      if (this.peerConnection.signalingState !== 'stable') {
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
        await this.createOffer();
      } catch (e) {
        // Silent error handling
      } finally {
        this.makingOffer = false;
        this.negotiationLock = false;
      }
    };
  }

  async restartIce() {
    if (this.isDestroyed) return;
    
    try {
      await this.peerConnection.restartIce();
    } catch (e) {
      if (this.onConnectionFailed && !this.isDestroyed) {
        setTimeout(() => {
          if (!this.isDestroyed) {
            this.onConnectionFailed();
          }
        }, 2000);
      }
    }
  }

  async createOffer() {
    if (this.isDestroyed || !this.peerConnection) return false;
    
    if (this.peerConnection.signalingState !== 'stable') {
      return false;
    }
    
    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      
      if (this.denoSignaling && !this.isDestroyed) {
        this.denoSignaling.sendOffer(this.targetUserId, offer);
      }
      return true;
    } catch (error) {
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
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  async handleOffer(offer) {
    if (this.isDestroyed) return false;
    
    const offerDesc = typeof offer.sdp === 'string' ? offer : { type: 'offer', sdp: offer };
    
    // Perfect negotiation logic for P2P
    const readyForOffer = this.peerConnection.signalingState === 'stable' || this.peerConnection.signalingState === 'have-remote-offer';
    const offerCollision = !readyForOffer && this.makingOffer;
    
    this.ignoreOffer = !this.polite && offerCollision;
    
    if (this.ignoreOffer) {
      return false;
    }
    
    this.isSettingRemoteDesc = true;
    
    try {
      if (offerCollision && this.polite) {
        await this.peerConnection.setLocalDescription({ type: 'rollback' });
        this.makingOffer = false;
      }
      
      await this.peerConnection.setRemoteDescription(offerDesc);
      
      await this.processQueuedIceCandidates();
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      if (this.denoSignaling && !this.isDestroyed) {
        this.denoSignaling.sendAnswer(this.targetUserId, answer);
      }
      
      return true;
    } catch (error) {
      return false;
    } finally {
      this.isSettingRemoteDesc = false;
    }
  }

  async handleAnswer(answer) {
    if (this.isDestroyed) return false;
    
    if (this.peerConnection.signalingState !== 'have-local-offer') {
      return false;
    }
    
    const answerDesc = typeof answer.sdp === 'string' ? answer : { type: 'answer', sdp: answer };
    
    this.isSettingRemoteDesc = true;
    
    try {
      await this.peerConnection.setRemoteDescription(answerDesc);
      await this.processQueuedIceCandidates();
      return true;
    } catch (error) {
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
      } else {
        this.queuedIceCandidates.push(candidate);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  async processQueuedIceCandidates() {
    if (this.isDestroyed) return;
    while (this.queuedIceCandidates.length > 0 && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
      const candidate = this.queuedIceCandidates.shift();
      try {
        await this.peerConnection.addIceCandidate(candidate);
      } catch (e) {
        // Silent error handling
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
          // Silent error handling
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

export { DenoP2PSignaling };