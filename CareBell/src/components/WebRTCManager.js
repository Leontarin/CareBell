// WebRTCManager.js
class WebRTCManager {
  constructor(localVideoRef, remoteVideoRef, socket, roomId, userId, polite) {
    this.localVideoRef   = localVideoRef;
    this.remoteVideoRef  = remoteVideoRef;
    this.socket          = socket;
    this.roomId          = roomId;
    this.userId          = userId;
    this.polite          = polite;
    this.peerConnection  = null;
    this.localStream     = null;
    this._remoteStream   = null;  // ← new MediaStream holder
    this.onConnectionFailed = null;
    // … other fields unchanged …
  }

  async initialize(localStream, isInitiator = false) {
    this.localStream = localStream;
    // … create RTCPeerConnection, add tracks …
    this.peerConnection.ontrack = (event) => {
      console.log("Got remote track", event.track.kind);

      // bucket into a single MediaStream
      if (!this._remoteStream) {
        this._remoteStream = new MediaStream();
      }

      if (event.streams && event.streams[0]) {
        this._remoteStream = event.streams[0];
      } else {
        this._remoteStream.addTrack(event.track);
      }

      // attach and play
      if (this.remoteVideoRef.current) {
        this.remoteVideoRef.current.srcObject = this._remoteStream;
        this.remoteVideoRef.current
          .play()
          .catch(e => console.log("Autoplay prevented:", e.message));
      }
    };

    // … rest of initialize (onicecandidate, onnegotiationneeded, etc.) …
  }

  // … handleSignal, handleOffer, handleAnswer, etc. unchanged …

  destroy() {
    // … cleanup code …
    if (this._remoteStream) {
      this._remoteStream.getTracks().forEach(t => t.stop());
      this._remoteStream = null;
    }
    // … rest unchanged …
  }
}

export { WebRTCManager };
