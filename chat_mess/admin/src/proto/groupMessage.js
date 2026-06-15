import protobuf from "protobufjs";

// Mirror of back/proto/group_message.proto. Group messages are transported as
// protobuf binary (both the GET .../messages response and the socket
// `groupMessageReceived` / `groupMessageUpdated` events).
const PROTO = `
syntax = "proto3";
package chat;

message Sender {
  int32 id = 1;
  string username = 2;
}

message GroupMessage {
  int32 id = 1;
  int32 group_id = 2;
  int32 user_id = 3;
  string text = 4;
  string type = 5;
  string file_url = 6;
  string filename = 7;
  int32 reply_to_id = 8;
  Sender sender = 9;
  bool is_deleted = 10;
  int64 created_at = 11;
  int64 updated_at = 12;
  GroupMessage replied_message = 13;
  string forwarded_from_type = 14;
  int32 forwarded_from_id = 15;
  string forwarded_from_username = 16;
  repeated int32 read_by = 17;
}

message GroupMessageList {
  repeated GroupMessage messages = 1;
}
`;

const root = protobuf.parse(PROTO).root;
const GroupMessage = root.lookupType("chat.GroupMessage");
const GroupMessageList = root.lookupType("chat.GroupMessageList");

const toObjOpts = { defaults: true, arrays: true, objects: true, longs: Number };

const asUint8 = (data) => {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data?.buffer) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return new Uint8Array(data);
};

// Normalize a decoded protobuf group message into the shape our UI expects
// (similar to a DM message: createdAt ISO string, sender, replyTo, etc).
const normalize = (m) => ({
  id: m.id,
  groupId: m.groupId,
  fromUserId: m.userId,
  userId: m.userId,
  text: m.text || "",
  type: m.type || "text",
  fileUrl: m.fileUrl || null,
  filename: m.filename || null,
  replyToId: m.replyToId || null,
  isDeleted: !!m.isDeleted,
  isEdited: !!(m.updatedAt && m.createdAt && m.updatedAt - m.createdAt > 1500),
  createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
  sender: m.sender ? { id: m.sender.id, username: m.sender.username } : null,
  readBy: Array.isArray(m.readBy) ? m.readBy : [],
  forwardedFromType: m.forwardedFromType || null,
  forwardedFromUsername: m.forwardedFromUsername || null,
  replyTo:
    m.repliedMessage && m.repliedMessage.id
      ? {
          id: m.repliedMessage.id,
          text: m.repliedMessage.text || m.repliedMessage.filename || "",
          fromUserId: m.repliedMessage.userId,
          username: m.repliedMessage.sender?.username,
        }
      : null,
});

export function decodeGroupMessageList(data) {
  const decoded = GroupMessageList.decode(asUint8(data));
  const obj = GroupMessageList.toObject(decoded, toObjOpts);
  return (obj.messages || []).map(normalize);
}

export function decodeGroupMessage(data) {
  const decoded = GroupMessage.decode(asUint8(data));
  const obj = GroupMessage.toObject(decoded, toObjOpts);
  return normalize(obj);
}
