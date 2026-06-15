const root = require("./group_message_pb");
const chat = root.chat;

console.log("Chat namespace:", chat);
console.log("GroupMessage constructor:", chat.GroupMessage);

if (!chat || !chat.GroupMessage) {
    console.error("GroupMessage constructor is undefined");
    process.exit(1);
}

const message = new chat.GroupMessage();
console.log("Message instance:", message);
console.log("Has setId:", typeof message.setId === "function");
console.log("Message prototype:", Object.getPrototypeOf(message));

if (typeof message.setId !== "function") {
    console.error("setId is not a function. Available methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(message)));
    message.id = 1;
    message.text = "Test message";
    console.log("Message after direct assignment:", message);
} else {
    message.setId(1);
    message.setText("Test message");
}

const buffer = chat.GroupMessage.encode(message).finish();
console.log("Serialized buffer:", buffer);

const decoded = chat.GroupMessage.decode(buffer);
console.log("Decoded object:", decoded);
console.log("Decoded type:", decoded.constructor.name);
console.log("Decoded prototype:", Object.getPrototypeOf(decoded));
console.log("Has toObject:", typeof decoded.toObject === "function");
if (typeof decoded.toObject !== "function") {
    console.log("Decoded as plain object:", JSON.stringify(decoded));
} else {
    console.log("Decoded message:", decoded.toObject());
}