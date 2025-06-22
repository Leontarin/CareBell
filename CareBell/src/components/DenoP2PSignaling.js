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
  }

  async connect() {
    try {
      console.log('🔌 Connecting to Deno P2P signaling server:', P2P_SIGNALING_URL);
      
      this.ws = new WebSocket(P2P_SIGNALING_URL);
      
      this.ws.onopen = () => {
        console.log('✅ Connected to Deno P2P signaling server');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
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
                this.onParticipantsUpdate(data.participants, data.newUser, data.leftUser);
              }
              break;

            case 'p2p-signal':
              console.log('📡 P2P signal from', data.fromUserId, ':', data.signal.type);
              if (this.onP2PSignal) {
                this.onP2PSignal(data.fromUserId, data.signal);
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
        console.log('🔌 Deno P2P signaling connection closed:', event.code, event.reason);
        this.isConnected = false;

        if (this.onDisconnected) {
          this.onDisconnected();
        }

        // Auto-reconnect if not intentional close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 Attempting to reconnect to Deno signaling (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          
          setTimeout(() => {
            this.connect();
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ Deno P2P signaling WebSocket error:', error);
        if (this.onError) {
          this.onError(error);
        }
      };

    } catch (error) {
      console.error('❌ Failed to connect to Deno P2P signaling:', error);
      if (this.onError) {
        this.onError(error);
      }
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
      signal: { sdp: offer }
    });
  }

  // Send WebRTC answer to specific peer
  sendAnswer(targetUserId, answer) {
    return this.send({
      type: 'answer',
      roomId: this.roomId,
      userId: this.userId,
      targetUserId: targetUserId,
      signal: { sdp: answer }
    });
  }

  // Send ICE candidate to specific peer
  sendIceCandidate(targetUserId, candidate) {
    return this.send({
      type: 'ice-candidate',
      roomId: this.roomId,
      userId: this.userId,
      targetUserId: targetUserId,
      signal: { candidate: candidate }
    });
  }

  // Leave room and disconnect
  disconnect() {
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
    console.log('👋 Disconnected from Deno P2P signaling');
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      readyState: this.ws?.readyState,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}