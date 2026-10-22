// Magic-byte detection for the image formats we accept from anonymous uploads.
// Same idea as imageExt() in services/whatsapp-bulk/server.mjs, extended with
// WEBP and HEIC/HEIF. Never trust the client-declared MIME type on its own.

export type SniffedImage = 'jpeg' | 'png' | 'webp' | 'heic'

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'heif'])

export function sniffImageType(buf: Uint8Array): SniffedImage | null {
  const b = buf
  if (
    b.length > 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return 'png'
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(b.subarray(from, to)))
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  if (b.length >= 12 && ascii(4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(8, 12))) return 'heic'
  return null
}

/** Maps a declared MIME type to the sniffed family it must correspond to. */
export function declaredFamily(mime: string): SniffedImage | null {
  switch (mime.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpeg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/heic':
    case 'image/heif':
      return 'heic'
    default:
      return null
  }
}
