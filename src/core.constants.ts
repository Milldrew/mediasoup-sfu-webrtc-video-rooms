// Core constants extracted from codebase

// Default values
export const DEFAULT_LOCALHOST_IP = '127.0.0.1'
export const IPV4_FAMILY = 'IPv4'

// Simulcast layers
export const SIMULCAST_SPATIAL_LAYER = 2
export const SIMULCAST_TEMPORAL_LAYER = 2

// Consumer paused state
export const CONSUMER_PAUSED = false

// WebRTC transport settings
export const WEBRTC_ENABLE_UDP = true
export const WEBRTC_ENABLE_TCP = true
export const WEBRTC_PREFER_UDP = true

// DTLS state
export const DTLS_STATE_CLOSED = 'closed'

// Event names
export const EVENT_DTLS_STATE_CHANGE = 'dtlsstatechange'
export const EVENT_TRANSPORT_CLOSE = '@close'
export const EVENT_TRANSPORT_CLOSE_LEGACY = 'transportclose'
export const EVENT_PRODUCER_CLOSE = 'producerclose'

// Socket events
export const SOCKET_EVENT_CREATE_ROOM = 'createRoom'
export const SOCKET_EVENT_JOIN = 'join'
export const SOCKET_EVENT_GET_PRODUCERS = 'getProducers'
export const SOCKET_EVENT_GET_ROUTER_RTP_CAPABILITIES = 'getRouterRtpCapabilities'
export const SOCKET_EVENT_CREATE_WEBRTC_TRANSPORT = 'createWebRtcTransport'
export const SOCKET_EVENT_CONNECT_TRANSPORT = 'connectTransport'
export const SOCKET_EVENT_PRODUCE = 'produce'
export const SOCKET_EVENT_CONSUME = 'consume'
export const SOCKET_EVENT_RESUME = 'resume'
export const SOCKET_EVENT_GET_MY_ROOM_INFO = 'getMyRoomInfo'
export const SOCKET_EVENT_DISCONNECT = 'disconnect'
export const SOCKET_EVENT_PRODUCER_CLOSED = 'producerClosed'
export const SOCKET_EVENT_EXIT_ROOM = 'exitRoom'
export const SOCKET_EVENT_NEW_PRODUCERS = 'newProducers'
export const SOCKET_EVENT_CONSUMER_CLOSED = 'consumerClosed'
export const SOCKET_EVENT_CONNECTION = 'connection'

// Response messages
export const RESPONSE_ALREADY_EXISTS = 'already exists'
export const RESPONSE_SUCCESS = 'success'
export const RESPONSE_SUCCESSFULLY_EXITED_ROOM = 'successfully exited room'

// Error messages
export const ERROR_ROOM_DOES_NOT_EXIST = 'Room does not exist'
export const ERROR_NOT_IN_A_ROOM = 'not is a room'
export const ERROR_NOT_CURRENTLY_IN_ROOM = 'not currently in a room'
export const ERROR_CAN_NOT_CONSUME = 'can not consume'
export const ERROR_CONSUME_FAILED = 'Consume failed'

// Process exit delay
export const PROCESS_EXIT_DELAY = 2000

// Logger messages
export const LOG_CREATED_ROOM = 'Created room'
export const LOG_USER_JOINED = 'User joined'
export const LOG_GET_PRODUCERS = 'Get producers'
export const LOG_GET_ROUTER_RTP_CAPABILITIES = 'Get RouterRtpCapabilities'
export const LOG_CREATE_WEBRTC_TRANSPORT = 'Create webrtc transport'
export const LOG_CONNECT_TRANSPORT = 'Connect transport'
export const LOG_PRODUCE = 'Produce'
export const LOG_CONSUMING = 'Consuming'
export const LOG_DISCONNECT = 'Disconnect'
export const LOG_PRODUCER_CLOSE = 'Producer close'
export const LOG_EXIT_ROOM = 'Exit room'
export const LOG_ADDING_TRANSPORT = 'Adding transport'
export const LOG_TRANSPORT_CLOSE = 'Transport close'
export const LOG_CONSUMER_CLOSED_DUE_TO_PRODUCER_CLOSE = 'Consumer closed due to producerclose event'
export const LOG_LISTENING_ON = 'Listening on https://'
export const LOG_MEDIASOUP_WORKER_DIED = 'mediasoup worker died, exiting in 2 seconds... [pid:%d]'