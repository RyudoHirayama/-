// シンプルなアプリアイコン(PNG)を生成するスクリプト。
// 外部ライブラリ不要 (Node 標準の zlib のみ使用)。
// 青背景に白いチャットの吹き出しを描画します。
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(size, draw) {
  const px = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y)
      const o = (y * size + x) * 4
      px[o] = r
      px[o + 1] = g
      px[o + 2] = b
      px[o + 3] = a
    }
  }
  // フィルタバイト(0)を各行の先頭に付与
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// 角丸長方形の内側判定
function inRoundedRect(x, y, left, top, right, bottom, r) {
  if (x < left || x > right || y < top || y > bottom) return false
  const cx = Math.min(Math.max(x, left + r), right - r)
  const cy = Math.min(Math.max(y, top + r), bottom - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

function drawIcon(size) {
  const bg = [37, 99, 235, 255] // #2563eb
  const white = [255, 255, 255, 255]
  const s = size
  const bl = s * 0.2
  const bt = s * 0.22
  const br = s * 0.8
  const bb = s * 0.62
  const radius = s * 0.1
  // 吹き出しのしっぽ(左下の三角)
  const tailTopX = s * 0.32
  return (x, y) => {
    // しっぽ
    if (y >= bb && y <= bb + s * 0.14 && x >= tailTopX && x <= tailTopX + (s * 0.14) * (1 - (y - bb) / (s * 0.14))) {
      return white
    }
    if (inRoundedRect(x, y, bl, bt, br, bb, radius)) {
      // 3つのドット(メッセージ風)
      const cy = (bt + bb) / 2
      const dotR = s * 0.035
      for (let i = -1; i <= 1; i++) {
        const dx = s * 0.5 + i * s * 0.16
        if ((x - dx) ** 2 + (y - cy) ** 2 <= dotR * dotR) return bg
      }
      return white
    }
    return bg
  }
}

for (const size of [192, 512]) {
  const png = encodePNG(size, drawIcon(size))
  writeFileSync(resolve(outDir, `icon-${size}.png`), png)
  console.log(`generated icon-${size}.png`)
}
console.log('done')
