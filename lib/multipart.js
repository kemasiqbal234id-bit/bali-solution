'use strict';
// Parser multipart/form-data minimal (tanpa dependensi). Body sudah dibatasi ukurannya oleh pemanggil.
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) throw new Error('Boundary multipart tidak ditemukan');
  const delim = Buffer.from('--' + (m[1] || m[2]));
  const fields = {};
  const files = [];
  let pos = buf.indexOf(delim);
  while (pos !== -1) {
    let start = pos + delim.length;
    if (buf[start] === 45 && buf[start + 1] === 45) break; // penutup "--"
    if (buf[start] === 13 && buf[start + 1] === 10) start += 2;
    const next = buf.indexOf(delim, start);
    if (next === -1) break;
    const part = buf.subarray(start, next - 2); // buang CRLF sebelum delimiter
    const hdrEnd = part.indexOf('\r\n\r\n');
    if (hdrEnd !== -1) {
      const headers = part.subarray(0, hdrEnd).toString('utf8');
      const body = part.subarray(hdrEnd + 4);
      const name = /name="([^"]*)"/i.exec(headers);
      const filename = /filename="([^"]*)"/i.exec(headers);
      if (name) {
        if (filename && filename[1] !== '') files.push({ field: name[1], filename: filename[1], data: body });
        else if (!filename) fields[name[1]] = body.toString('utf8');
      }
    }
    pos = next;
  }
  return { fields, files };
}
module.exports = { parseMultipart };
