// src/config.ts
import * as os from 'os';
import { RtpCodecCapability } from 'mediasoup/node/lib/RtpParameters';
import { TransportListenIp } from 'mediasoup/node/lib/Transport';

const ifaces = os.networkInterfaces();

const getLocalIp = (): string => {
  let localIp = '127.0.0.1';
  Object.keys(ifaces).forEach((ifname) => {
    const ifaceList = ifaces[ifname];
    if (!ifaceList) return;
    
    for (const iface of ifaceList) {
      // Ignore IPv6 and 127.0.0.1
      if (iface.family !== 'IPv4' || iface.internal !== false) {
        continue;
      }
      // Set the local ip to the first IPv4 address found and exit the loop
      localIp = iface.address;
      return;
    }
  });
  return localIp;
};

interface Config {
  listenIp: string;
  listenPort: number;
  sslCrt: string;
  sslKey: string;
  mediasoup: {
    numWorkers: number;
    worker: {
      rtcMinPort: number;
      rtcMaxPort: number;
      logLevel: string;
      logTags: string[];
    };
    router: {
      mediaCodecs: RtpCodecCapability[];
    };
    webRtcTransport: {
      listenIps: TransportListenIp[];
      maxIncomingBitrate: number;
      initialAvailableOutgoingBitrate: number;
    };
  };
}

const config: Config = {
  listenIp: '0.0.0.0',
  listenPort: 3016,
  sslCrt: '../ssl/cert.pem',
  sslKey: '../ssl/key.pem',

  mediasoup: {
    // Worker settings
    numWorkers: Object.keys(os.cpus()).length,
    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: 'warn',
      logTags: [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp'
        // 'rtx',
        // 'bwe',
        // 'score',
        // 'simulcast',
        // 'svc'
      ]
    },
    // Router settings
    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000
          }
        }
      ]
    },
    // WebRtcTransport settings
    webRtcTransport: {
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: getLocalIp() // replace by public IP address
        }
      ],
      maxIncomingBitrate: 1500000,
      initialAvailableOutgoingBitrate: 1000000
    }
  }
};

export default config;
