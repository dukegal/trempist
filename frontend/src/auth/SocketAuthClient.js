// ===============================================================
// SocketAuthClient.js — Browser-side Socket Authentication Client
//
// Architecture:
//   Browser  ──WSS──►  /ws/auth (FastAPI proxy)  ──TCP──►  AuthServer
//
// Protocol (mirrors the Python AuthProtocol exactly):
//   Frame 0  (received): plaintext JSON HELLO  { cmd, session_key }
//   Frame N  (sent):     AES-256-GCM encrypted { cmd, data }
//   Frame N  (received): AES-256-GCM encrypted { cmd, ok, token/error }
//
// Encryption:
//   - Session key: 256-bit AES key sent by the server in HELLO (base-64)
//   - Algorithm:   AES-256-GCM via the browser's built-in Web Crypto API
//   - Per-message: fresh 12-byte random IV prepended to each ciphertext
//
// Usage:
//   const client = new SocketAuthClient()
//   await client.connect()
//   const result = await client.login({ email, password })
//   // result: { token, user_id, name }
//   client.disconnect()
// ===============================================================

// WebSocket URL — relative path works for same-origin; absolute for dev proxies
const WS_URL =
  import.meta.env.VITE_AUTH_WS_URL ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/auth`

class SocketAuthClient {
  constructor() {
    /** @type {WebSocket|null} */
    this._ws = null
    /** @type {CryptoKey|null} AES-256-GCM key received in HELLO */
    this._key = null
    /** @type {{resolve: Function, reject: Function}|null} in-flight request */
    this._pending = null
    this._connected = false
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Open the WebSocket, wait for the HELLO handshake, import the session key.
   * Must be called (and awaited) before register() or login().
   * @returns {Promise<SocketAuthClient>} this instance, for chaining
   */
  connect() {
    return new Promise((resolve, reject) => {
      this._ws = new WebSocket(WS_URL)
      this._ws.binaryType = 'arraybuffer'

      this._ws.onopen = () => {
        // Waiting for HELLO — nothing to do here yet
      }

      this._ws.onmessage = async (event) => {
        try {
          const bytes = new Uint8Array(event.data)

          if (!this._connected) {
            // ── HELLO (plaintext JSON) ──────────────────────────
            const hello = JSON.parse(new TextDecoder().decode(bytes))
            if (hello.cmd !== 'HELLO' || !hello.session_key) {
              throw new Error('Invalid HELLO frame')
            }
            this._key       = await this._importKey(hello.session_key)
            this._connected = true
            resolve(this)
            return
          }

          // ── Encrypted response ──────────────────────────────
          const response = await this._decrypt(bytes)
          if (this._pending) {
            if (response.ok) {
              this._pending.resolve(response)
            } else {
              this._pending.reject(new Error(response.error || 'Server error'))
            }
            this._pending = null
          }
        } catch (err) {
          if (this._pending) {
            this._pending.reject(err)
            this._pending = null
          } else {
            reject(err)
          }
        }
      }

      this._ws.onerror = () => {
        const err = new Error('WebSocket connection failed — is the server running?')
        if (this._pending) { this._pending.reject(err); this._pending = null }
        else reject(err)
      }

      this._ws.onclose = () => {
        this._connected = false
        if (this._pending) {
          this._pending.reject(new Error('Connection closed unexpectedly'))
          this._pending = null
        }
      }
    })
  }

  /**
   * Register a new user.
   * @param {{ name: string, email: string, phone: string, password: string }} fields
   * @returns {Promise<{ token: string, user_id: number, name: string }>}
   */
  async register({ name, email, phone, password }) {
    return this._sendCommand('REGISTER', { name, email, phone, password })
  }

  /**
   * Authenticate an existing user.
   * @param {{ email: string, password: string }} fields
   * @returns {Promise<{ token: string, user_id: number, name: string }>}
   */
  async login({ email, password }) {
    return this._sendCommand('LOGIN', { email, password })
  }

  /** Gracefully close the connection. */
  disconnect() {
    if (this._ws) {
      try { this._ws.close() } catch (_) { /* ignore */ }
    }
    this._ws       = null
    this._key      = null
    this._connected = false
  }

  // ── Private helpers ─────────────────────────────────────────────

  async _sendCommand(cmd, data) {
    if (!this._connected || !this._key) {
      throw new Error('SocketAuthClient: not connected — call connect() first')
    }
    if (this._pending) {
      throw new Error('SocketAuthClient: another request is already in flight')
    }
    const encrypted = await this._encrypt({ cmd, data })
    this._ws.send(encrypted)
    return new Promise((resolve, reject) => {
      this._pending = { resolve, reject }
    })
  }

  /**
   * Import a base-64 encoded 256-bit raw AES key as a Web Crypto CryptoKey.
   * @param {string} b64Key
   * @returns {Promise<CryptoKey>}
   */
  async _importKey(b64Key) {
    const raw = Uint8Array.from(atob(b64Key), (c) => c.charCodeAt(0))
    return crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM' },
      false,                   // not extractable
      ['encrypt', 'decrypt'],
    )
  }

  /**
   * AES-256-GCM encrypt.
   * Output layout:  IV (12 bytes) || ciphertext+tag
   * Matches Python: AESGCM(key).encrypt(iv, plaintext, None) → ciphertext+tag
   * @param {object} payload
   * @returns {Promise<ArrayBuffer>}
   */
  async _encrypt(payload) {
    const plaintext = new TextEncoder().encode(JSON.stringify(payload))
    const iv        = crypto.getRandomValues(new Uint8Array(12))  // fresh 12-byte IV
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this._key,
      plaintext,
    )
    // Concatenate IV + ciphertext into a single ArrayBuffer
    const result = new Uint8Array(12 + ciphertext.byteLength)
    result.set(iv, 0)
    result.set(new Uint8Array(ciphertext), 12)
    return result.buffer
  }

  /**
   * AES-256-GCM decrypt.
   * Expects: IV (12 bytes) || ciphertext+tag
   * @param {Uint8Array} data
   * @returns {Promise<object>}
   */
  async _decrypt(data) {
    if (data.byteLength < 12 + 16) {
      throw new Error('Encrypted frame too short')
    }
    const iv         = data.slice(0, 12)
    const ciphertext = data.slice(12)
    const plaintext  = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this._key,
      ciphertext,
    )
    return JSON.parse(new TextDecoder().decode(plaintext))
  }
}

export default SocketAuthClient
