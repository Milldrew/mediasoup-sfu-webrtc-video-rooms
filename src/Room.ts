// src/Room.ts
// import { WebRtcTransport, DtlsParameters } from 'mediasoup/node/lib/WebRtcTransport'
import { Server as SocketIOServer } from 'socket.io'
import config from './config'
import Peer from './Peer'
import { AppData, Router, Worker, DtlsParameters, RtpParameters, RtpCapabilities } from 'mediasoup/node/lib/types'
import { WEBRTC_ENABLE_UDP, WEBRTC_ENABLE_TCP, WEBRTC_PREFER_UDP, DTLS_STATE_CLOSED, EVENT_DTLS_STATE_CHANGE, EVENT_TRANSPORT_CLOSE, EVENT_PRODUCER_CLOSE, SOCKET_EVENT_NEW_PRODUCERS, SOCKET_EVENT_CONSUMER_CLOSED, LOG_TRANSPORT_CLOSE, LOG_ADDING_TRANSPORT, LOG_CONSUMER_CLOSED_DUE_TO_PRODUCER_CLOSE, ERROR_CAN_NOT_CONSUME } from './core.constants'

export default class Room {
  public id: string
  public router!: Router<AppData>
  public peers: Map<string, Peer>
  public io: SocketIOServer

  constructor(room_id: string, worker: Worker, io: SocketIOServer) {
    this.id = room_id
    const mediaCodecs = config.mediasoup.router.mediaCodecs
    worker
      .createRouter({
        mediaCodecs
      })
      .then((router) => {
        this.router = router
      })

    this.peers = new Map()
    this.io = io
  }

  addPeer(peer: Peer): void {
    this.peers.set(peer.id, peer)
  }

  getProducerListForPeer(): Array<{ producer_id: string }> {
    const producerList: Array<{ producer_id: string }> = []
    this.peers.forEach((peer) => {
      peer.producers.forEach((producer) => {
        producerList.push({
          producer_id: producer.id
        })
      })
    })
    return producerList
  }

  getRtpCapabilities(): RtpCapabilities {
    return this.router.rtpCapabilities
  }

  async createWebRtcTransport(socket_id: string): Promise<{
    params: {
      id: string
      iceParameters: any
      iceCandidates: any
      dtlsParameters: any
    }
  }> {
    const { maxIncomingBitrate, initialAvailableOutgoingBitrate } = config.mediasoup.webRtcTransport

    const transport = await this.router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: WEBRTC_ENABLE_UDP,
      enableTcp: WEBRTC_ENABLE_TCP,
      preferUdp: WEBRTC_PREFER_UDP,
      initialAvailableOutgoingBitrate
    })

    if (maxIncomingBitrate) {
      try {
        await transport.setMaxIncomingBitrate(maxIncomingBitrate)
      } catch (error) {}
    }

    transport.on(EVENT_DTLS_STATE_CHANGE, (dtlsState) => {
      if (dtlsState === DTLS_STATE_CLOSED) {
        console.log(LOG_TRANSPORT_CLOSE, { name: this.peers.get(socket_id)?.name })
        transport.close()
      }
    })

    transport.on(EVENT_TRANSPORT_CLOSE, () => {
      console.log(LOG_TRANSPORT_CLOSE, { name: this.peers.get(socket_id)?.name })
    })

    console.log(LOG_ADDING_TRANSPORT, { transportId: transport.id })
    this.peers.get(socket_id)?.addTransport(transport)
    return {
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      }
    }
  }

  async connectPeerTransport(socket_id: string, transport_id: string, dtlsParameters: DtlsParameters): Promise<void> {
    if (!this.peers.has(socket_id)) return

    await this.peers.get(socket_id)!.connectTransport(transport_id, dtlsParameters)
  }

  async produce(
    socket_id: string,
    producerTransportId: string,
    rtpParameters: RtpParameters,
    kind: string
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const producer = await this.peers.get(socket_id)!.createProducer(producerTransportId, rtpParameters, kind)
      resolve(producer.id)
      this.broadCast(socket_id, SOCKET_EVENT_NEW_PRODUCERS, [
        {
          producer_id: producer.id,
          producer_socket_id: socket_id
        }
      ])
    })
  }

  async consume(
    socket_id: string,
    consumer_transport_id: string,
    producer_id: string,
    rtpCapabilities: RtpCapabilities
  ): Promise<any> {
    // handle nulls
    if (
      !this.router.canConsume({
        producerId: producer_id,
        rtpCapabilities
      })
    ) {
      console.error(ERROR_CAN_NOT_CONSUME)
      return
    }

    const result = await this.peers.get(socket_id)!.createConsumer(consumer_transport_id, producer_id, rtpCapabilities)

    if (!result) return

    const { consumer, params } = result

    consumer.on(EVENT_PRODUCER_CLOSE, () => {
      console.log(LOG_CONSUMER_CLOSED_DUE_TO_PRODUCER_CLOSE, {
        name: `${this.peers.get(socket_id)?.name}`,
        consumer_id: `${consumer.id}`
      })
      this.peers.get(socket_id)?.removeConsumer(consumer.id)
      // tell client consumer is dead
      this.io.to(socket_id).emit(SOCKET_EVENT_CONSUMER_CLOSED, {
        consumer_id: consumer.id
      })
    })

    return params
  }

  async removePeer(socket_id: string): Promise<void> {
    this.peers.get(socket_id)?.close()
    this.peers.delete(socket_id)
  }

  closeProducer(socket_id: string, producer_id: string): void {
    this.peers.get(socket_id)?.closeProducer(producer_id)
  }

  broadCast(socket_id: string, name: string, data: any): void {
    for (const otherID of Array.from(this.peers.keys()).filter((id) => id !== socket_id)) {
      this.send(otherID, name, data)
    }
  }

  send(socket_id: string, name: string, data: any): void {
    this.io.to(socket_id).emit(name, data)
  }

  getPeers(): Map<string, Peer> {
    return this.peers
  }

  toJson(): { id: string; peers: string } {
    return {
      id: this.id,
      peers: JSON.stringify([...this.peers])
    }
  }
}
