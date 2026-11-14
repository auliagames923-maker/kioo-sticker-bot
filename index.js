import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
} from '@whiskeysockets/baileys'

import pino from 'pino'
import sharp from 'sharp'

const logger = pino({ level: 'silent' })

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./session')

  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: true,
    markOnlineOnConnect: false
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('Kioo Sticker Bot berhasil terhubung!')
    }

    if (connection === 'close') {
      const status = lastDisconnect?.error?.output?.statusCode

      if (status !== DisconnectReason.loggedOut) {
        startBot()
      } else {
        console.log('Sesi WhatsApp terputus. Perlu login ulang.')
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue

      const jid = msg.key.remoteJid
      const content = msg.message
      const image = content.imageMessage
      const text = content.conversation ||
        content.extendedTextMessage?.text ||
        ''

      try {
        if (text.toLowerCase() === '.menu') {
          await sock.sendMessage(jid, {
            text: `🤍 KIOO STICKER BOT

✧ .menu — melihat menu
✧ .sticker — membuat stiker

Send foto dengan caption .sticker untuk membuat stiker!`
          })
        }

        if (image && (
          image.caption?.toLowerCase().trim() === '.sticker' ||
          !image.caption
        )) {
          await sock.sendMessage(jid, {
            text: '☁️ sedang membuat stikermu...'
          })

          const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger, reuploadRequest: sock.updateMediaMessage }
          )

          const sticker = await sharp(buffer)
            .rotate()
            .resize(512, 512, {
              fit: 'contain',
              background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp({ quality: 80 })
            .toBuffer()

          await sock.sendMessage(jid, {
            sticker
          })
        }
      } catch (error) {
        console.error('Bot error:', error)

        await sock.sendMessage(jid, {
          text: 'Maaf, stikernya gagal dibuat. Coba lagi ya! 🤍'
        })
      }
    }
  })
}

startBot()
