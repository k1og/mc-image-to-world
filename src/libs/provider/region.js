const { promisify } = require('util')
const nbt = require('prismarine-nbt')
const zlib = require('zlib')
 
const deflateAsync = promisify(zlib.deflate)
const gunzipAsync = promisify(zlib.gunzip)
const inflateAsync = promisify(zlib.inflate)

const fs = require('fs/promises')
/** Helper to create a zero-filled buffer */
function createFilledBuffer(size, value) {
  const b = Buffer.alloc(size)
  b.fill(value)
  return b
}
 
/** In-memory file abstraction compatible with fs.open() object */
class MemoryFile {
  constructor(size = 0) {
    this.buffer = Buffer.alloc(size)
  }
 
  async read(buffer, offset, length, position) {
    this.buffer.copy(buffer, 0, position, position + length)
    return { bytesRead: length, buffer }
  }
 
  async write(buffer, offset, length, position) {
    const end = position + length
    if (end > this.buffer.length) {
      const newBuf = Buffer.alloc(end)
      this.buffer.copy(newBuf)
      this.buffer = newBuf
    }
    buffer.copy(this.buffer, position, 0, length)
    return { bytesWritten: length, buffer }
  }
 
  async stat() {
    return {
      isFile: () => true,
      size: this.buffer.length,
      mtime: new Date()
    }
  }
 
  async close() {
    // no-op for memory
  }
}
 
/** In-memory version of the Minecraft RegionFile format */
class RegionFile {
  constructor(name) {
    this.name = name
    this.lastModified = 0
    this.q = Promise.resolve()
    this.file = new MemoryFile() // store in memory
  }
 
  async initialize() {
    this.ini = this._initialize()
    await this.ini
  }
 
  async _initialize() {
    this.offsets = []
    this.chunkTimestamps = []
    this.sizeDelta = 0
 
    const stat = await this.file.stat()
    if (stat.isFile()) this.lastModified = stat.mtime
 
    // Ensure at least two header sectors
    if (stat.size < RegionFile.SECTOR_BYTES * 2) {
      await this.file.write(createFilledBuffer(RegionFile.SECTOR_BYTES * 2, 0), 0, RegionFile.SECTOR_BYTES * 2, 0)
      this.sizeDelta += RegionFile.SECTOR_BYTES * 2
    }
 
    const nSectors = Math.max(stat.size / RegionFile.SECTOR_BYTES, 2)
    this.sectorFree = Array(nSectors).fill(true)
    this.sectorFree[0] = false
    this.sectorFree[1] = false
 
    const offsetsBuf = Buffer.alloc(RegionFile.SECTOR_BYTES)
    const timestampsBuf = Buffer.alloc(RegionFile.SECTOR_BYTES)
 
    await this.file.read(offsetsBuf, 0, RegionFile.SECTOR_BYTES, 0)
    await this.file.read(timestampsBuf, 0, RegionFile.SECTOR_BYTES, RegionFile.SECTOR_BYTES)
 
    for (let i = 0; i < RegionFile.SECTOR_INTS; i++) {
      const offset = offsetsBuf.readUInt32BE(i * 4)
      this.offsets[i] = offset
      if (offset !== 0) {
        const sectorNumber = offset >> 8
        const count = offset & 0xFF
        for (let s = 0; s < count; s++) {
          if (sectorNumber + s < this.sectorFree.length) {
            this.sectorFree[sectorNumber + s] = false
          }
        }
      }
      this.chunkTimestamps[i] = timestampsBuf.readUInt32BE(i * 4)
    }
  }
 
  getSizeDelta() {
    const ret = this.sizeDelta
    this.sizeDelta = 0
    return ret
  }
 
  async read(x, z) {
    await this.ini
    if (RegionFile.outOfBounds(x, z)) throw new Error(`READ ${x},${z} out of bounds`)
 
    const offset = this.getOffset(x, z)
    if (offset === 0) return null
 
    const sectorNumber = offset >> 8
    const numSectors = offset & 0xFF
 
    const lengthBuf = Buffer.alloc(4)
    await this.file.read(lengthBuf, 0, 4, sectorNumber * RegionFile.SECTOR_BYTES)
    const length = lengthBuf.readUInt32BE(0)
    if (length <= 1) throw new Error(`wrong length ${length}`)
 
    const versionBuf = Buffer.alloc(1)
    await this.file.read(versionBuf, 0, 1, sectorNumber * RegionFile.SECTOR_BYTES + 4)
    const version = versionBuf.readUInt8(0)
 
    const data = Buffer.alloc(length - 1)
    await this.file.read(data, 0, length - 1, sectorNumber * RegionFile.SECTOR_BYTES + 5)
 
    const decompress = version === RegionFile.VERSION_GZIP ? gunzipAsync : inflateAsync
    const uncompressed = await decompress(data)
    return nbt.parseUncompressed(uncompressed)
  }
 
  async write(x, z, nbtData) {
    this.q = this.q.then(() => this._write(x, z, nbtData))
    await this.q
  }
 
  async _write(x, z, nbtData) {
    await this.ini
    const uncompressedData = nbt.writeUncompressed(nbtData)
    const data = await deflateAsync(uncompressedData)
    const length = data.length + 1
 
    const offset = this.getOffset(x, z)
    let sectorNumber = offset >> 8
    const sectorsAllocated = offset & 0xFF
    const sectorsNeeded = Math.floor((length + RegionFile.CHUNK_HEADER_SIZE) / RegionFile.SECTOR_BYTES) + 1
 
    if (sectorsNeeded >= 256) throw new Error('maximum chunk size is 1MB')
 
    if (sectorNumber !== 0 && sectorsAllocated === sectorsNeeded) {
      await this.writeChunk(sectorNumber, data, length)
    } else {
      for (let i = 0; i < sectorsAllocated; i++) {
        if (sectorNumber + i < this.sectorFree.length) this.sectorFree[sectorNumber + i] = true
      }
 
      let runStart = -1
      let runLength = 0
      for (let i = 0; i < this.sectorFree.length; i++) {
        if (this.sectorFree[i]) {
          if (runLength === 0) runStart = i
          runLength++
          if (runLength >= sectorsNeeded) break
        } else runLength = 0
      }
 
      if (runLength >= sectorsNeeded) {
        sectorNumber = runStart
        await this.setOffset(x, z, (sectorNumber << 8) | sectorsNeeded)
        for (let i = 0; i < sectorsNeeded; i++) this.sectorFree[sectorNumber + i] = false
        await this.writeChunk(sectorNumber, data, length)
      } else {
        sectorNumber = this.sectorFree.length
        const growSize = sectorsNeeded * RegionFile.SECTOR_BYTES
        await this.file.write(createFilledBuffer(growSize, 0), 0, growSize, this.file.buffer.length)
        for (let i = 0; i < sectorsNeeded; i++) this.sectorFree.push(false)
        this.sizeDelta += RegionFile.SECTOR_BYTES * sectorsNeeded
        await this.writeChunk(sectorNumber, data, length)
        await this.setOffset(x, z, (sectorNumber << 8) | sectorsNeeded)
      }
    }
 
    await this.setTimestamp(x, z, Math.floor(Date.now() / 1000))
  }
 
  async writeChunk(sectorNumber, data, length) {
    const buffer = Buffer.alloc(4 + 1 + length)
    buffer.writeUInt32BE(length, 0)
    buffer.writeUInt8(RegionFile.VERSION_DEFLATE, 4)
    data.copy(buffer, 5)
    await this.file.write(buffer, 0, buffer.length, sectorNumber * RegionFile.SECTOR_BYTES)
  }
 
  static outOfBounds(x, z) {
    return x < 0 || x >= 32 || z < 0 || z >= 32
  }
 
  getOffset(x, z) {
    return this.offsets[x + z * 32] || 0
  }
 
  hasChunk(x, z) {
    return this.getOffset(x, z) !== 0
  }
 
  async setOffset(x, z, offset) {
    this.offsets[x + z * 32] = offset
    const buffer = Buffer.alloc(4)
    buffer.writeUInt32BE(offset, 0)
    await this.file.write(buffer, 0, 4, (x + z * 32) * 4)
  }
 
  async setTimestamp(x, z, value) {
    this.chunkTimestamps[x + z * 32] = value
    const buffer = Buffer.alloc(4)
    buffer.writeUInt32BE(value, 0)
    await this.file.write(buffer, 0, 4, RegionFile.SECTOR_BYTES + (x + z * 32) * 4)
  }
 
  async close() {
    await this.file.close()
  }
 
  getBuffer() {
    return this.file.buffer
  }

  getName() {
    return this.name
  }
}
 
RegionFile.VERSION_GZIP = 1
RegionFile.VERSION_DEFLATE = 2
RegionFile.SECTOR_BYTES = 4096
RegionFile.SECTOR_INTS = RegionFile.SECTOR_BYTES / 4
RegionFile.CHUNK_HEADER_SIZE = 5
 
if (process.env.NODE_DEBUG && /anvil/.test(process.env.NODE_DEBUG)) {
  RegionFile.debug = console.log
} else {
  RegionFile.debug = () => {}
}
 
module.exports = RegionFile