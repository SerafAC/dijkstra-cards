/**
 * generate-icons.mjs
 *
 * Generates placeholder PNG icons for the browser extension.
 * Uses only Node.js built-ins (zlib for deflate compression).
 * Run with: node scripts/generate-icons.mjs
 *
 * Replace the generated icons with your own artwork before publishing.
 */

import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ICONS_DIR = join(__dirname, '../public/icons')

// Brand color: indigo #6366f1  (r=99, g=102, b=241)
const BRAND = [99, 102, 241]

// ──────────────────────────────────────────────────────────────
// Minimal pure-JS PNG encoder (solid color, no dependencies)
// ──────────────────────────────────────────────────────────────

function crc32(buf) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function createSolidPNG(size, [r, g, b]) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR: width, height, bit-depth=8, color-type=2 (RGB), rest=0
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB

  // Raw scanlines: filter byte (0) + RGB pixels
  const rowLen = 1 + size * 3
  const raw = Buffer.alloc(size * rowLen)
  for (let y = 0; y < size; y++) {
    const off = y * rowLen
    raw[off] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      raw[off + 1 + x * 3] = r
      raw[off + 1 + x * 3 + 1] = g
      raw[off + 1 + x * 3 + 2] = b
    }
  }

  const idat = deflateSync(raw, { level: 9 })

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ──────────────────────────────────────────────────────────────
// Generate icons
// ──────────────────────────────────────────────────────────────

mkdirSync(ICONS_DIR, { recursive: true })

for (const size of [16, 32, 48, 128]) {
  const buf = createSolidPNG(size, BRAND)
  const outPath = join(ICONS_DIR, `icon-${size}.png`)
  writeFileSync(outPath, buf)
  console.log(`  ✓ icons/icon-${size}.png`)
}

console.log('Icons generated. Replace them with your own artwork before publishing.')
