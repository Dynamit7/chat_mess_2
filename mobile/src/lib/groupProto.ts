/**
 * Minimal, dependency-free proto3 decoder for the group-message wire format.
 *
 * We can't use protobufjs on Hermes (its decoder relies on `new Function`
 * codegen, which Hermes disables). The schema (back/message_gr.proto) is small
 * and stable, so we decode it by hand. Mirrors web/src/proto/groupMessage.js.
 */

type Bytes = Uint8Array;

function toBytes(data: any): Bytes {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data?.buffer) return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
  return new Uint8Array(data);
}

/** Read a base-128 varint as a JS number (safe for our <2^53 values). */
function readVarint(buf: Bytes, pos: number): [number, number] {
  let value = 0;
  let mul = 1;
  for (;;) {
    const b = buf[pos++];
    value += (b & 0x7f) * mul;
    if ((b & 0x80) === 0) break;
    mul *= 128;
  }
  return [value, pos];
}

/** Decode a UTF-8 byte range to a string (no TextDecoder dependency). */
function utf8(buf: Bytes, start: number, end: number): string {
  let s = '';
  let i = start;
  while (i < end) {
    const c = buf[i++];
    if (c < 0x80) s += String.fromCharCode(c);
    else if (c < 0xe0) s += String.fromCharCode(((c & 0x1f) << 6) | (buf[i++] & 0x3f));
    else if (c < 0xf0) s += String.fromCharCode(((c & 0x0f) << 12) | ((buf[i++] & 0x3f) << 6) | (buf[i++] & 0x3f));
    else {
      const cp = ((c & 0x07) << 18) | ((buf[i++] & 0x3f) << 12) | ((buf[i++] & 0x3f) << 6) | (buf[i++] & 0x3f);
      const u = cp - 0x10000;
      s += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
    }
  }
  return s;
}

type RawField = { field: number; wire: number; num?: number; bytes?: Bytes; start?: number; end?: number };

function* fields(buf: Bytes, start: number, end: number): Generator<RawField> {
  let pos = start;
  while (pos < end) {
    let tag: number;
    [tag, pos] = readVarint(buf, pos);
    const field = Math.floor(tag / 8);
    const wire = tag & 7;
    if (wire === 0) {
      let num: number;
      [num, pos] = readVarint(buf, pos);
      yield { field, wire, num };
    } else if (wire === 2) {
      let len: number;
      [len, pos] = readVarint(buf, pos);
      yield { field, wire, bytes: buf, start: pos, end: pos + len };
      pos += len;
    } else if (wire === 1) {
      pos += 8;
    } else if (wire === 5) {
      pos += 4;
    } else {
      break;
    }
  }
}

export type GroupMsg = {
  id: number;
  groupId: number;
  fromUserId: number;
  userId: number;
  text: string;
  type: string;
  fileUrl: string | null;
  filename: string | null;
  replyToId: number | null;
  isDeleted: boolean;
  isEdited: boolean;
  createdAt: string;
  sender: { id: number; username: string } | null;
  readBy: number[];
  forwardedFromType: string | null;
  forwardedFromUsername: string | null;
  replyTo: { id: number; text: string; fromUserId: number; username?: string } | null;
};

function decodeSender(buf: Bytes, start: number, end: number): { id: number; username: string } {
  let id = 0;
  let username = '';
  for (const f of fields(buf, start, end)) {
    if (f.field === 1 && f.wire === 0) id = f.num!;
    else if (f.field === 2 && f.wire === 2) username = utf8(buf, f.start!, f.end!);
  }
  return { id, username };
}

function decodeMsg(buf: Bytes, start: number, end: number): GroupMsg {
  const m: any = { readBy: [], text: '', type: 'text' };
  let createdAt = 0;
  let updatedAt = 0;
  let sender: { id: number; username: string } | null = null;
  let replied: GroupMsg | null = null;
  for (const f of fields(buf, start, end)) {
    switch (f.field) {
      case 1: m.id = f.num; break;
      case 2: m.groupId = f.num; break;
      case 3: m.userId = f.num; break;
      case 4: m.text = utf8(buf, f.start!, f.end!); break;
      case 5: m.type = utf8(buf, f.start!, f.end!); break;
      case 6: m.fileUrl = utf8(buf, f.start!, f.end!); break;
      case 7: m.filename = utf8(buf, f.start!, f.end!); break;
      case 8: m.replyToId = f.num; break;
      case 9: sender = decodeSender(buf, f.start!, f.end!); break;
      case 10: m.isDeleted = !!f.num; break;
      case 11: createdAt = f.num!; break;
      case 12: updatedAt = f.num!; break;
      case 13: replied = decodeMsg(buf, f.start!, f.end!); break;
      case 14: m.forwardedFromType = utf8(buf, f.start!, f.end!); break;
      case 15: m.forwardedFromId = f.num; break;
      case 16: m.forwardedFromUsername = utf8(buf, f.start!, f.end!); break;
      case 17:
        if (f.wire === 0) m.readBy.push(f.num);
        else if (f.wire === 2) {
          // packed repeated int32
          let p = f.start!;
          while (p < f.end!) {
            let v: number;
            [v, p] = readVarint(buf, p);
            m.readBy.push(v);
          }
        }
        break;
    }
  }
  return {
    id: m.id,
    groupId: m.groupId,
    fromUserId: m.userId,
    userId: m.userId,
    text: m.text || '',
    type: m.type || 'text',
    fileUrl: m.fileUrl || null,
    filename: m.filename || null,
    replyToId: m.replyToId || null,
    isDeleted: !!m.isDeleted,
    isEdited: !!(updatedAt && createdAt && updatedAt - createdAt > 1500),
    createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
    sender: sender && sender.id ? sender : null,
    readBy: m.readBy,
    forwardedFromType: m.forwardedFromType || null,
    forwardedFromUsername: m.forwardedFromUsername || null,
    replyTo:
      replied && replied.id
        ? { id: replied.id, text: replied.text || replied.filename || '', fromUserId: replied.userId, username: replied.sender?.username }
        : null,
  };
}

/** Decode a GroupMessageList (field 1 = repeated GroupMessage). */
export function decodeGroupMessageList(data: ArrayBuffer | Uint8Array): GroupMsg[] {
  const buf = toBytes(data);
  const out: GroupMsg[] = [];
  for (const f of fields(buf, 0, buf.length)) {
    if (f.field === 1 && f.wire === 2) out.push(decodeMsg(buf, f.start!, f.end!));
  }
  return out;
}

/** Decode a single GroupMessage (socket payloads). */
export function decodeGroupMessage(data: ArrayBuffer | Uint8Array): GroupMsg {
  const buf = toBytes(data);
  return decodeMsg(buf, 0, buf.length);
}

/** Is this socket payload binary protobuf (vs a plain JSON object)? */
export function isBinary(d: any): boolean {
  return d instanceof ArrayBuffer || d instanceof Uint8Array || (d && typeof d.byteLength === 'number' && d.constructor !== Object);
}
