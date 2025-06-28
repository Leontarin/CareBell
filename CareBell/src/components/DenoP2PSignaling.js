// src/components/DenoP2PSignaling.js
import { P2P_SIGNALING_URL } from '../shared/config';

export class DenoP2PSignaling {
  constructor(roomId, userId) {
    this.roomId = roomId;
    this.userId = userId;
    this.ws = null;
    this.isConnected = false;
    this.messageQueue = [];
    
    // Event callbacks
    this.onP2PSignal = null;
    this.onParticipantsUpdate = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.onError = null;

    // Auto-reconnection
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    // Health check
    this.pingInterval = null;
    this.lastPong = Date.now();
  }

  async connect() {
    try {
      console.log('🔌 Connecting to Deno P2P signaling server:', P2P_SIGNALING_URL);
      
      // Close existing connection if any
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      
      this.ws = new WebSocket(P2P_SIGNALING_URL);
      
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          console.error('⏰ WebSocket connection timeout');
          this.ws.close();
          this.handleConnectionError(new Error('Connection timeout'));
        }
      }, 10000);
      
      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ Connected to Deno P2P signaling server');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastPong = Date.now();
        
        // Start ping/pong for connection health monitoring
        this.startHealthCheck();
        
        // Join the room
        this.send({
          type: 'join-room',
          roomId: this.roomId,
          userId: this.userId
        });

        // Send any queued messages
        this.messageQueue.forEach(message => this.send(message));
        this.messageQueue = [];

        if (this.onConnected) {
          this.onConnected();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📥 Received from Deno signaling:', data.type, data);

          switch (data.type) {
            case 'connected':
              console.log('🚀 Deno P2P server welcome:', data.message);
              break;

            case 'room-participants':
              console.log('👥 Participants update:', data.participants);
              if (this.onParticipantsUpdate) {
                this.onParticipantsUpdate(
                  data.participants, 
                  data.newUser, 
                  data.leftUser,
                  data.participantDetails
                );
              }
              break;

            case 'p2p-signal':
              console.log('📡 P2P signal from', data.fromUserId, ':', data.signal.type);
              if (this.onP2PSignal) {
                this.onP2PSignal(data.fromUserId, data.signal);
              }
              break;

            case 'pong':
              this.lastPong = Date.now();
              console.log('🏓 Received pong from server');
              break;

            case 'error':
              console.error('❌ Server error:', data.message);
              if (this.onError) {
                this.onError(new Error(data.message));
              }
              break;

            default:
              console.log('❓ Unknown message type from Deno signaling:', data.type);
          }
        } catch (error) {
          console.error('❌ Error parsing Deno signaling message:', error);
        }
      };

      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        this.stopHealthCheck();
        
        console.log('🔌 Deno P2P signaling connection closed:', event.code, event.reason);
        this.isConnected = false;

        if (this.onDisconnected) {
          this.onDisconnected();
        }

        // Auto-reconnect if not intentional close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          console.log(`🔄 Attempting to reconnect to Deno signaling (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
          
          setTimeout(() => {
            this.connect();
          }, delay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached');
          if (this.onError) {
            this.onError(new Error('Failed to connect after maximum retry attempts'));
          }
        }
      };

      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('❌ Deno P2P signaling WebSocket error:', error);
        this.handleConnectionError(error);
      };

    } catch (error) {
      console.error('❌ Failed to connect to Deno P2P signaling:', error);
      this.handleConnectionError(error);
    }
  }

  startHealthCheck() {
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        // Check if we received a pong recently
        if (Date.now() - this.lastPong > 60000) { // 60 seconds
          console.warn('⚠️ No pong received, connection may be stale');
          this.ws.close();
          return;
        }
        
        // Send ping
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, 30000); // Ping every 30 seconds
  }

  stopHealthCheck() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  handleConnectionError(error) {
    if (this.onError) {
      this.onError(error);
    }
  }

  send(message) {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('❌ Failed to send message to Deno signaling:', error);
        return false;
      }
    } else {
      // Queue message for when connection is ready
      console.log('📦 Queueing message for Deno signaling (not connected yet)');
      this.messageQueue.push(message);
      return false;
    }
  }

  // Send WebRTC offer to specific peer
  sendOffer(targetUserId, offer) {
    return this.send({
      type: 'offer',
      roomId: this.roomId,
      userId: this.userId,
      targetUserId: targetUserId,
      signal: { type: 'offer', sdp: offer }
    });
  }

  // Send WebRTC answer to specific peer
  sendAnswer(targetUserId, answer) {
    return this.send({
      type: 'answer',
      roomId: this.roomId,
      userId: this.userId,
      targetUserId: targetUserId,
      signal: { type: 'answer', sdp: answer }
    });
  }

  // Send ICE candidate to specific peer
  sendIceCandidate(targetUserId, candidate) {
    return this.send({
      type: 'ice-candidate',
      roomId: this.roomId,
      userId: this.userId,
      targetUserId: targetUserId,
      signal: { type: 'ice-candidate', candidate: candidate }
    });
  }

  // Send mute state to specific peer
  sendMuteState(targetUserId, isMuted) {
    return this.send({
      type: 'mute-state',
      roomId: this.roomId,
      userId: this.userId,
      targetUserId: targetUserId,
      signal: { 
        type: 'mute-state', 
        isMuted: isMuted,
        timestamp: Date.now()
      }
    });
  }

  // Broadcast mute state to all participants in room
  broadcastMuteState(isMuted) {
    return this.send({
      type: 'broadcast-mute-state',
      roomId: this.roomId,
      userId: this.userId,
      signal: { 
        type: 'mute-state', 
        isMuted: isMuted,
        timestamp: Date.now()
      }
    });
  }

  // Leave room and disconnect
  disconnect() {
    this.stopHealthCheck();
    
    if (this.isConnected) {
      this.send({
        type: 'leave-room',
        roomId: this.roomId,
        userId: this.userId
      });
    }

    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
    console.log('👋 Disconnected from Deno P2P signaling');
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      readyState: this.ws?.readyState,
      reconnectAttempts: this.reconnectAttempts,
      lastPong: this.lastPong
    };
  }
}