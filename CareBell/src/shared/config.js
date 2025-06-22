export const API = "https://carebelldb.vercel.app";
export const API_WS = 'wss://carebellp2p.deno.dev';
//export const API = "http://localhost:4443";



export const P2P_CONFIG = {
  MAX_PARTICIPANTS: 6,
  CONNECTION_TIMEOUT: 30000,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 3000,
  
  VIDEO_CONSTRAINTS: {
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 15, max: 30 }
  },
  
  AUDIO_CONSTRAINTS: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100
  },

  RTC_CONFIG: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:openrelay.metered.ca:80' }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  }
};