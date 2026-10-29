// Small deterministic ZIP writer: STORE only, UTF-8, no ZIP64 or executable hooks.
const encoder = new TextEncoder();
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));}
  return (crc ^ 0xffffffff) >>> 0;
}
export function createZip(files) {
  if (!Array.isArray(files) || !files.length || files.length > 100) throw new RangeError('Expected 1–100 files');
  const names = new Set(); let offset = 0, centralSize = 0, size = 0;
  const local = [], central = [];
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || !/^[a-zA-Z0-9_-][a-zA-Z0-9_./-]{0,180}$/.test(file.path) || file.path.split('/').some(p => !p || p === '.' || p === '..' || p.startsWith('.')) || names.has(file.path.toLowerCase())) throw new TypeError('Unsafe or duplicate ZIP path');
    names.add(file.path.toLowerCase());
    if (typeof file.content !== 'string') throw new TypeError('ZIP contents must be text');
    const name = encoder.encode(file.path), data = encoder.encode(file.content); size += data.length;
    if (size > 5 * 1024 * 1024) throw new RangeError('ZIP budget exceeded');
    const checksum = crc32(data), header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(12, 33, true);
    h.setUint32(14, checksum, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); header.set(name, 30);
    const directory = new Uint8Array(46 + name.length), d = new DataView(directory.buffer);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x800, true); d.setUint16(14, 33, true);
    d.setUint32(16, checksum, true); d.setUint32(20, data.length, true); d.setUint32(24, data.length, true); d.setUint16(28, name.length, true); d.setUint32(42, offset, true); directory.set(name, 46);
    local.push(header, data); central.push(directory); offset += header.length + data.length; centralSize += directory.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + end.length); let pos = 0;
  for (const part of [...local, ...central, end]) {result.set(part, pos); pos += part.length;}
  return result;
}
