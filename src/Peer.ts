// src/Peer.ts

import { Transport, Producer, Consumer, DtlsParameters, RtpParameters, RtpCapabilities } from 'mediasoup/node/lib/types'
import { SIMULCAST_SPATIAL_LAYER, SIMULCAST_TEMPORAL_LAYER, CONSUMER_PAUSED, EVENT_TRANSPORT_CLOSE_LEGACY } from './core.constants'
export default class Peer {
  public id: string
  public name: string
  public transports: Map<string, Transport>
  public consumers: Map<string, Consumer>
  public producers: Map<string, Producer>

  constructor(socket_id: string, name: string) {
    this.id = socket_id
    this.name = name
    this.transports = new Map()
    this.consumers = new Map()
    this.producers = new Map()
  }

  addTransport(transport: Transport): void {
    this.transports.set(transport.id, transport)
  }

  async connectTransport(transport_id: string, dtlsParameters: DtlsParameters): Promise<void> {
    if (!this.transports.has(transport_id)) return

    await this.transports.get(transport_id)!.connect({
      dtlsParameters: dtlsParameters
    })
  }

  async createProducer(producerTransportId: string, rtpParameters: RtpParameters, kind: string): Promise<Producer> {
    //TODO handle null errors
    const producer = await this.transports.get(producerTransportId)!.produce({
      kind: kind as 'audio' | 'video',
      rtpParameters
    })

    this.producers.set(producer.id, producer)

    producer.on(EVENT_TRANSPORT_CLOSE_LEGACY, () => {
      console.log('Producer transport close', { name: `${this.name}`, consumer_id: `${producer.id}` })
      producer.close()
      this.producers.delete(producer.id)
    })

    return producer
  }

  async createConsumer(
    consumer_transport_id: string,
    producer_id: string,
    rtpCapabilities: RtpCapabilities
  ): Promise<
    | {
        consumer: Consumer
        params: {
          producerId: string
          id: string
          kind: string
          rtpParameters: RtpParameters
          type: string
          producerPaused: boolean
        }
      }
    | undefined
  > {
    const consumerTransport = this.transports.get(consumer_transport_id)
    if (!consumerTransport) return

    let consumer: Consumer
    try {
      consumer = await consumerTransport.consume({
        producerId: producer_id,
        rtpCapabilities,
        paused: CONSUMER_PAUSED //producer.kind === 'video',
      })
    } catch (error) {
      console.error('Consume failed', error)
      return
    }

    if (consumer.type === 'simulcast') {
      await consumer.setPreferredLayers({
        spatialLayer: SIMULCAST_SPATIAL_LAYER,
        temporalLayer: SIMULCAST_TEMPORAL_LAYER
      })
    }

    this.consumers.set(consumer.id, consumer)

    consumer.on(EVENT_TRANSPORT_CLOSE_LEGACY, () => {
      console.log('Consumer transport close', { name: `${this.name}`, consumer_id: `${consumer.id}` })
      this.consumers.delete(consumer.id)
    })

    return {
      consumer,
      params: {
        producerId: producer_id,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused
      }
    }
  }

  closeProducer(producer_id: string): void {
    try {
      this.producers.get(producer_id)?.close()
    } catch (e) {
      console.warn(e)
    }

    this.producers.delete(producer_id)
  }

  getProducer(producer_id: string): Producer | undefined {
    return this.producers.get(producer_id)
  }

  close(): void {
    this.transports.forEach((transport) => transport.close())
  }

  removeConsumer(consumer_id: string): void {
    this.consumers.delete(consumer_id)
  }
}
