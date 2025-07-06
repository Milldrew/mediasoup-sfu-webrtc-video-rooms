// src/app.ts
import express from 'express'
//@ts-ignore
import https from 'httpolyglot'
import fs from 'fs'
import * as mediasoup from 'mediasoup'
import { Server as SocketIOServer } from 'socket.io'
import path from 'path'
import config from './config'
import Room from './Room'
import Peer from './Peer'
import { Worker } from 'mediasoup/node/lib/types'
import { 
  SOCKET_EVENT_CONNECTION,
  SOCKET_EVENT_CREATE_ROOM,
  SOCKET_EVENT_JOIN,
  SOCKET_EVENT_GET_PRODUCERS,
  SOCKET_EVENT_GET_ROUTER_RTP_CAPABILITIES,
  SOCKET_EVENT_CREATE_WEBRTC_TRANSPORT,
  SOCKET_EVENT_CONNECT_TRANSPORT,
  SOCKET_EVENT_PRODUCE,
  SOCKET_EVENT_CONSUME,
  SOCKET_EVENT_RESUME,
  SOCKET_EVENT_GET_MY_ROOM_INFO,
  SOCKET_EVENT_DISCONNECT,
  SOCKET_EVENT_PRODUCER_CLOSED,
  SOCKET_EVENT_EXIT_ROOM,
  SOCKET_EVENT_NEW_PRODUCERS,
  RESPONSE_ALREADY_EXISTS,
  RESPONSE_SUCCESS,
  RESPONSE_SUCCESSFULLY_EXITED_ROOM,
  ERROR_ROOM_DOES_NOT_EXIST,
  ERROR_NOT_IN_A_ROOM,
  ERROR_NOT_CURRENTLY_IN_ROOM,
  PROCESS_EXIT_DELAY,
  LOG_CREATED_ROOM,
  LOG_USER_JOINED,
  LOG_GET_PRODUCERS,
  LOG_GET_ROUTER_RTP_CAPABILITIES,
  LOG_CREATE_WEBRTC_TRANSPORT,
  LOG_CONNECT_TRANSPORT,
  LOG_PRODUCE,
  LOG_CONSUMING,
  LOG_DISCONNECT,
  LOG_PRODUCER_CLOSE,
  LOG_EXIT_ROOM,
  LOG_LISTENING_ON,
  LOG_MEDIASOUP_WORKER_DIED
} from './core.constants'

const app = express()

const options = {
  key: fs.readFileSync(path.join(__dirname, config.sslKey), 'utf-8'),
  cert: fs.readFileSync(path.join(__dirname, config.sslCrt), 'utf-8')
}

const httpsServer = https.createServer(options, app)
const io = new SocketIOServer(httpsServer)

app.use(express.static(path.join(__dirname, '..', 'public')))

httpsServer.listen(config.listenPort, () => {
  console.log(LOG_LISTENING_ON + config.listenIp + ':' + config.listenPort)
})

// all mediasoup workers
let workers: Worker[] = []
let nextMediasoupWorkerIdx = 0

/**
 * roomList
 * {
 *  room_id: Room {
 *      id:
 *      router:
 *      peers: {
 *          id:,
 *          name:,
 *          master: [boolean],
 *          transports: [Map],
 *          producers: [Map],
 *          consumers: [Map],
 *          rtpCapabilities:
 *      }
 *  }
 * }
 */
let roomList = new Map<string, Room>()

;(async () => {
  await createWorkers()
})()

async function createWorkers(): Promise<void> {
  const { numWorkers } = config.mediasoup

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.worker.logLevel as any,
      logTags: config.mediasoup.worker.logTags as any,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort
    })

    worker.on('died', () => {
      console.error(LOG_MEDIASOUP_WORKER_DIED, worker.pid)
      setTimeout(() => process.exit(1), PROCESS_EXIT_DELAY)
    })
    workers.push(worker)

    // log worker resource usage
    /*setInterval(async () => {
            const usage = await worker.getResourceUsage();

            console.info('mediasoup Worker resource usage [pid:%d]: %o', worker.pid, usage);
        }, 120000);*/
  }
}

interface SocketWithRoomId extends SocketIOServer {
  room_id?: string
}

io.on(SOCKET_EVENT_CONNECTION, (socket: any) => {
  socket.on(SOCKET_EVENT_CREATE_ROOM, async ({ room_id }: { room_id: string }, callback: (result: string) => void) => {
    if (roomList.has(room_id)) {
      callback(RESPONSE_ALREADY_EXISTS)
    } else {
      console.log(LOG_CREATED_ROOM, { room_id: room_id })
      const worker = await getMediasoupWorker()
      roomList.set(room_id, new Room(room_id, worker, io))
      callback(room_id)
    }
  })

  socket.on(SOCKET_EVENT_JOIN, ({ room_id, name }: { room_id: string; name: string }, cb: (result: any) => void) => {
    console.log(LOG_USER_JOINED, {
      room_id: room_id,
      name: name
    })

    if (!roomList.has(room_id)) {
      return cb({
        error: ERROR_ROOM_DOES_NOT_EXIST
      })
    }

    roomList.get(room_id)!.addPeer(new Peer(socket.id, name))
    socket.room_id = room_id

    cb(roomList.get(room_id)!.toJson())
  })

  socket.on(SOCKET_EVENT_GET_PRODUCERS, () => {
    if (!roomList.has(socket.room_id)) return
    console.log(LOG_GET_PRODUCERS, { name: `${roomList.get(socket.room_id)!.getPeers().get(socket.id)?.name}` })

    // send all the current producer to newly joined member
    const producerList = roomList.get(socket.room_id)!.getProducerListForPeer()

    socket.emit(SOCKET_EVENT_NEW_PRODUCERS, producerList)
  })

  socket.on(SOCKET_EVENT_GET_ROUTER_RTP_CAPABILITIES, (_: any, callback: (result: any) => void) => {
    console.log(LOG_GET_ROUTER_RTP_CAPABILITIES, {
      name: `${roomList.get(socket.room_id)!.getPeers().get(socket.id)?.name}`
    })

    try {
      callback(roomList.get(socket.room_id)!.getRtpCapabilities())
    } catch (e: any) {
      callback({
        error: e.message
      })
    }
  })

  socket.on(SOCKET_EVENT_CREATE_WEBRTC_TRANSPORT, async (_: any, callback: (result: any) => void) => {
    console.log(LOG_CREATE_WEBRTC_TRANSPORT, {
      name: `${roomList.get(socket.room_id)!.getPeers().get(socket.id)?.name}`
    })

    try {
      const { params } = await roomList.get(socket.room_id)!.createWebRtcTransport(socket.id)

      callback(params)
    } catch (err: any) {
      console.error(err)
      callback({
        error: err.message
      })
    }
  })

  socket.on(
    SOCKET_EVENT_CONNECT_TRANSPORT,
    async (
      { transport_id, dtlsParameters }: { transport_id: string; dtlsParameters: any },
      callback: (result: string) => void
    ) => {
      console.log(LOG_CONNECT_TRANSPORT, { name: `${roomList.get(socket.room_id)!.getPeers().get(socket.id)?.name}` })

      if (!roomList.has(socket.room_id)) return
      await roomList.get(socket.room_id)!.connectPeerTransport(socket.id, transport_id, dtlsParameters)

      callback(RESPONSE_SUCCESS)
    }
  )

  socket.on(
    SOCKET_EVENT_PRODUCE,
    async (
      { kind, rtpParameters, producerTransportId }: { kind: string; rtpParameters: any; producerTransportId: string },
      callback: (result: any) => void
    ) => {
      if (!roomList.has(socket.room_id)) {
        return callback({ error: ERROR_NOT_IN_A_ROOM })
      }

      const producer_id = await roomList
        .get(socket.room_id)!
        .produce(socket.id, producerTransportId, rtpParameters, kind)

      console.log(LOG_PRODUCE, {
        type: `${kind}`,
        name: `${roomList.get(socket.room_id)!.getPeers().get(socket.id)?.name}`,
        id: `${producer_id}`
      })

      callback({
        producer_id
      })
    }
  )

  socket.on(
    SOCKET_EVENT_CONSUME,
    async (
      {
        consumerTransportId,
        producerId,
        rtpCapabilities
      }: { consumerTransportId: string; producerId: string; rtpCapabilities: any },
      callback: (result: any) => void
    ) => {
      //TODO null handling
      const params = await roomList
        .get(socket.room_id)!
        .consume(socket.id, consumerTransportId, producerId, rtpCapabilities)

      console.log(LOG_CONSUMING, {
        name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id)!.getPeers().get(socket.id)?.name}`,
        producer_id: `${producerId}`,
        consumer_id: `${params.id}`
      })

      callback(params)
    }
  )

  socket.on(SOCKET_EVENT_RESUME, async (data: any, callback: () => void) => {
    // Note: consumer is not defined in the original code, this might be a bug
    // await consumer.resume()
    callback()
  })

  socket.on(SOCKET_EVENT_GET_MY_ROOM_INFO, (_: any, cb: (result: any) => void) => {
    cb(roomList.get(socket.room_id)!.toJson())
  })

  socket.on(SOCKET_EVENT_DISCONNECT, () => {
    console.log(LOG_DISCONNECT, {
      name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id)!.getPeers().get(socket.id)?.name}`
    })

    if (!socket.room_id) return
    roomList.get(socket.room_id)!.removePeer(socket.id)
  })

  socket.on(SOCKET_EVENT_PRODUCER_CLOSED, ({ producer_id }: { producer_id: string }) => {
    console.log(LOG_PRODUCER_CLOSE, {
      name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id)!.getPeers().get(socket.id)?.name}`
    })

    roomList.get(socket.room_id)!.closeProducer(socket.id, producer_id)
  })

  socket.on(SOCKET_EVENT_EXIT_ROOM, async (_: any, callback: (result: any) => void) => {
    console.log(LOG_EXIT_ROOM, {
      name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id)!.getPeers().get(socket.id)?.name}`
    })

    if (!roomList.has(socket.room_id)) {
      callback({
        error: ERROR_NOT_CURRENTLY_IN_ROOM
      })
      return
    }
    // close transports
    await roomList.get(socket.room_id)!.removePeer(socket.id)
    if (roomList.get(socket.room_id)!.getPeers().size === 0) {
      roomList.delete(socket.room_id)
    }

    socket.room_id = null

    callback(RESPONSE_SUCCESSFULLY_EXITED_ROOM)
  })
})

// TODO remove - never used?
function room(): any[] {
  return Object.values(roomList).map((r) => {
    return {
      router: r.router.id,
      peers: Object.values(r.peers).map((p: any) => {
        return {
          name: p.name
        }
      }),
      id: r.id
    }
  })
}

/**
 * Get next mediasoup Worker.
 */
function getMediasoupWorker(): Worker {
  const worker = workers[nextMediasoupWorkerIdx]
  if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0
  return worker
}
