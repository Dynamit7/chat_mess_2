/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.ChatMessage = (function() {

    /**
     * Properties of a ChatMessage.
     * @exports IChatMessage
     * @interface IChatMessage
     * @property {number|null} [id] ChatMessage id
     * @property {number|null} [fromUserId] ChatMessage fromUserId
     * @property {number|null} [toUserId] ChatMessage toUserId
     * @property {string|null} [text] ChatMessage text
     * @property {string|null} [type] ChatMessage type
     * @property {string|null} [fileUrl] ChatMessage fileUrl
     * @property {string|null} [filename] ChatMessage filename
     * @property {boolean|null} [isRead] ChatMessage isRead
     * @property {string|null} [createdAt] ChatMessage createdAt
     * @property {number|null} [replyToId] ChatMessage replyToId
     * @property {ChatMessage.IReplyTo|null} [replyTo] ChatMessage replyTo
     * @property {Array.<IReaction>|null} [reactions] ChatMessage reactions
     */

    /**
     * Constructs a new ChatMessage.
     * @exports ChatMessage
     * @classdesc Represents a ChatMessage.
     * @implements IChatMessage
     * @constructor
     * @param {IChatMessage=} [properties] Properties to set
     */
    function ChatMessage(properties) {
        this.reactions = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * ChatMessage id.
     * @member {number} id
     * @memberof ChatMessage
     * @instance
     */
    ChatMessage.prototype.id = 0;

    /**
     * ChatMessage fromUserId.
     * @member {number} fromUserId
     * @memberof ChatMessage
     * @instance
     */
    ChatMessage.prototype.fromUserId = 0;

    /**
     * ChatMessage toUserId.
     * @member {number} toUserId
     * @memberof ChatMessage
     * @instance
     */
    ChatMessage.prototype.toUserId = 0;

    /**
     * ChatMessage text.
     * @member {string} text
     * @memberof ChatMessage
     * @instance
     */
    ChatMessage.prototype.text = "";

    /**
     * ChatMessage type.
     * @member {string} type
     * @memberof ChatMessage
     * @instance
     */
    ChatMessage.prototype.type = "";

    /**
     * ChatMessage fileUrl.
     * @member {string} fileUrl
     * @memberof ChatMessage
     * @instance
     */
    ChatMessage.prototype.fileUrl = "";

    /**
     * ChatMessage filename.
     * @member {string} filename
     * @memberof ChatMessage
     * @instance
     */
    ChatMessage.prototype.filename = "";

    /**
     * ChatMessage isRead.
     * @member {boolean} isRead
     * @memberof ChatMessage
     * @instance
     */
    ChatMessage.prototype.isRead = false;

    /**
     * ChatMessage createdAt.
     * @member {string} createdAt
     * @memberof ChatMessage
     * @instance
     */
    ChatMessage.prototype.createdAt = "";

    /**
     * ChatMessage replyToId.
     * @member {number} replyToId
     * @memberof ChatMessage
     * @instance
     */
    ChatMessage.prototype.replyToId = 0;

    /**
     * ChatMessage replyTo.
     * @member {ChatMessage.IReplyTo|null|undefined} replyTo
     * @memberof ChatMessage
     * @instance
     */
    ChatMessage.prototype.replyTo = null;

    /**
     * ChatMessage reactions.
     * @member {Array.<IReaction>} reactions
     * @memberof ChatMessage
     * @instance
     */
    ChatMessage.prototype.reactions = $util.emptyArray;

    /**
     * Creates a new ChatMessage instance using the specified properties.
     * @function create
     * @memberof ChatMessage
     * @static
     * @param {IChatMessage=} [properties] Properties to set
     * @returns {ChatMessage} ChatMessage instance
     */
    ChatMessage.create = function create(properties) {
        return new ChatMessage(properties);
    };

    /**
     * Encodes the specified ChatMessage message. Does not implicitly {@link ChatMessage.verify|verify} messages.
     * @function encode
     * @memberof ChatMessage
     * @static
     * @param {IChatMessage} message ChatMessage message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ChatMessage.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.id != null && Object.hasOwnProperty.call(message, "id"))
            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.id);
        if (message.fromUserId != null && Object.hasOwnProperty.call(message, "fromUserId"))
            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.fromUserId);
        if (message.toUserId != null && Object.hasOwnProperty.call(message, "toUserId"))
            writer.uint32(/* id 3, wireType 0 =*/24).int32(message.toUserId);
        if (message.text != null && Object.hasOwnProperty.call(message, "text"))
            writer.uint32(/* id 4, wireType 2 =*/34).string(message.text);
        if (message.type != null && Object.hasOwnProperty.call(message, "type"))
            writer.uint32(/* id 5, wireType 2 =*/42).string(message.type);
        if (message.fileUrl != null && Object.hasOwnProperty.call(message, "fileUrl"))
            writer.uint32(/* id 6, wireType 2 =*/50).string(message.fileUrl);
        if (message.filename != null && Object.hasOwnProperty.call(message, "filename"))
            writer.uint32(/* id 7, wireType 2 =*/58).string(message.filename);
        if (message.isRead != null && Object.hasOwnProperty.call(message, "isRead"))
            writer.uint32(/* id 8, wireType 0 =*/64).bool(message.isRead);
        if (message.createdAt != null && Object.hasOwnProperty.call(message, "createdAt"))
            writer.uint32(/* id 9, wireType 2 =*/74).string(message.createdAt);
        if (message.replyToId != null && Object.hasOwnProperty.call(message, "replyToId"))
            writer.uint32(/* id 10, wireType 0 =*/80).int32(message.replyToId);
        if (message.replyTo != null && Object.hasOwnProperty.call(message, "replyTo"))
            $root.ChatMessage.ReplyTo.encode(message.replyTo, writer.uint32(/* id 14, wireType 2 =*/114).fork()).ldelim();
        if (message.reactions != null && message.reactions.length)
            for (var i = 0; i < message.reactions.length; ++i)
                $root.Reaction.encode(message.reactions[i], writer.uint32(/* id 15, wireType 2 =*/122).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified ChatMessage message, length delimited. Does not implicitly {@link ChatMessage.verify|verify} messages.
     * @function encodeDelimited
     * @memberof ChatMessage
     * @static
     * @param {IChatMessage} message ChatMessage message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ChatMessage.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a ChatMessage message from the specified reader or buffer.
     * @function decode
     * @memberof ChatMessage
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {ChatMessage} ChatMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ChatMessage.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ChatMessage();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.id = reader.int32();
                break;
            case 2:
                message.fromUserId = reader.int32();
                break;
            case 3:
                message.toUserId = reader.int32();
                break;
            case 4:
                message.text = reader.string();
                break;
            case 5:
                message.type = reader.string();
                break;
            case 6:
                message.fileUrl = reader.string();
                break;
            case 7:
                message.filename = reader.string();
                break;
            case 8:
                message.isRead = reader.bool();
                break;
            case 9:
                message.createdAt = reader.string();
                break;
            case 10:
                message.replyToId = reader.int32();
                break;
            case 14:
                message.replyTo = $root.ChatMessage.ReplyTo.decode(reader, reader.uint32());
                break;
            case 15:
                if (!(message.reactions && message.reactions.length))
                    message.reactions = [];
                message.reactions.push($root.Reaction.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a ChatMessage message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof ChatMessage
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {ChatMessage} ChatMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ChatMessage.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ChatMessage message.
     * @function verify
     * @memberof ChatMessage
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ChatMessage.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.id != null && message.hasOwnProperty("id"))
            if (!$util.isInteger(message.id))
                return "id: integer expected";
        if (message.fromUserId != null && message.hasOwnProperty("fromUserId"))
            if (!$util.isInteger(message.fromUserId))
                return "fromUserId: integer expected";
        if (message.toUserId != null && message.hasOwnProperty("toUserId"))
            if (!$util.isInteger(message.toUserId))
                return "toUserId: integer expected";
        if (message.text != null && message.hasOwnProperty("text"))
            if (!$util.isString(message.text))
                return "text: string expected";
        if (message.type != null && message.hasOwnProperty("type"))
            if (!$util.isString(message.type))
                return "type: string expected";
        if (message.fileUrl != null && message.hasOwnProperty("fileUrl"))
            if (!$util.isString(message.fileUrl))
                return "fileUrl: string expected";
        if (message.filename != null && message.hasOwnProperty("filename"))
            if (!$util.isString(message.filename))
                return "filename: string expected";
        if (message.isRead != null && message.hasOwnProperty("isRead"))
            if (typeof message.isRead !== "boolean")
                return "isRead: boolean expected";
        if (message.createdAt != null && message.hasOwnProperty("createdAt"))
            if (!$util.isString(message.createdAt))
                return "createdAt: string expected";
        if (message.replyToId != null && message.hasOwnProperty("replyToId"))
            if (!$util.isInteger(message.replyToId))
                return "replyToId: integer expected";
        if (message.replyTo != null && message.hasOwnProperty("replyTo")) {
            var error = $root.ChatMessage.ReplyTo.verify(message.replyTo);
            if (error)
                return "replyTo." + error;
        }
        if (message.reactions != null && message.hasOwnProperty("reactions")) {
            if (!Array.isArray(message.reactions))
                return "reactions: array expected";
            for (var i = 0; i < message.reactions.length; ++i) {
                var error = $root.Reaction.verify(message.reactions[i]);
                if (error)
                    return "reactions." + error;
            }
        }
        return null;
    };

    /**
     * Creates a ChatMessage message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof ChatMessage
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {ChatMessage} ChatMessage
     */
    ChatMessage.fromObject = function fromObject(object) {
        if (object instanceof $root.ChatMessage)
            return object;
        var message = new $root.ChatMessage();
        if (object.id != null)
            message.id = object.id | 0;
        if (object.fromUserId != null)
            message.fromUserId = object.fromUserId | 0;
        if (object.toUserId != null)
            message.toUserId = object.toUserId | 0;
        if (object.text != null)
            message.text = String(object.text);
        if (object.type != null)
            message.type = String(object.type);
        if (object.fileUrl != null)
            message.fileUrl = String(object.fileUrl);
        if (object.filename != null)
            message.filename = String(object.filename);
        if (object.isRead != null)
            message.isRead = Boolean(object.isRead);
        if (object.createdAt != null)
            message.createdAt = String(object.createdAt);
        if (object.replyToId != null)
            message.replyToId = object.replyToId | 0;
        if (object.replyTo != null) {
            if (typeof object.replyTo !== "object")
                throw TypeError(".ChatMessage.replyTo: object expected");
            message.replyTo = $root.ChatMessage.ReplyTo.fromObject(object.replyTo);
        }
        if (object.reactions) {
            if (!Array.isArray(object.reactions))
                throw TypeError(".ChatMessage.reactions: array expected");
            message.reactions = [];
            for (var i = 0; i < object.reactions.length; ++i) {
                if (typeof object.reactions[i] !== "object")
                    throw TypeError(".ChatMessage.reactions: object expected");
                message.reactions[i] = $root.Reaction.fromObject(object.reactions[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a ChatMessage message. Also converts values to other types if specified.
     * @function toObject
     * @memberof ChatMessage
     * @static
     * @param {ChatMessage} message ChatMessage
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ChatMessage.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults)
            object.reactions = [];
        if (options.defaults) {
            object.id = 0;
            object.fromUserId = 0;
            object.toUserId = 0;
            object.text = "";
            object.type = "";
            object.fileUrl = "";
            object.filename = "";
            object.isRead = false;
            object.createdAt = "";
            object.replyToId = 0;
            object.replyTo = null;
        }
        if (message.id != null && message.hasOwnProperty("id"))
            object.id = message.id;
        if (message.fromUserId != null && message.hasOwnProperty("fromUserId"))
            object.fromUserId = message.fromUserId;
        if (message.toUserId != null && message.hasOwnProperty("toUserId"))
            object.toUserId = message.toUserId;
        if (message.text != null && message.hasOwnProperty("text"))
            object.text = message.text;
        if (message.type != null && message.hasOwnProperty("type"))
            object.type = message.type;
        if (message.fileUrl != null && message.hasOwnProperty("fileUrl"))
            object.fileUrl = message.fileUrl;
        if (message.filename != null && message.hasOwnProperty("filename"))
            object.filename = message.filename;
        if (message.isRead != null && message.hasOwnProperty("isRead"))
            object.isRead = message.isRead;
        if (message.createdAt != null && message.hasOwnProperty("createdAt"))
            object.createdAt = message.createdAt;
        if (message.replyToId != null && message.hasOwnProperty("replyToId"))
            object.replyToId = message.replyToId;
        if (message.replyTo != null && message.hasOwnProperty("replyTo"))
            object.replyTo = $root.ChatMessage.ReplyTo.toObject(message.replyTo, options);
        if (message.reactions && message.reactions.length) {
            object.reactions = [];
            for (var j = 0; j < message.reactions.length; ++j)
                object.reactions[j] = $root.Reaction.toObject(message.reactions[j], options);
        }
        return object;
    };

    /**
     * Converts this ChatMessage to JSON.
     * @function toJSON
     * @memberof ChatMessage
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ChatMessage.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    ChatMessage.ReplyTo = (function() {

        /**
         * Properties of a ReplyTo.
         * @memberof ChatMessage
         * @interface IReplyTo
         * @property {number|null} [id] ReplyTo id
         * @property {string|null} [text] ReplyTo text
         * @property {number|null} [fromUserId] ReplyTo fromUserId
         */

        /**
         * Constructs a new ReplyTo.
         * @memberof ChatMessage
         * @classdesc Represents a ReplyTo.
         * @implements IReplyTo
         * @constructor
         * @param {ChatMessage.IReplyTo=} [properties] Properties to set
         */
        function ReplyTo(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ReplyTo id.
         * @member {number} id
         * @memberof ChatMessage.ReplyTo
         * @instance
         */
        ReplyTo.prototype.id = 0;

        /**
         * ReplyTo text.
         * @member {string} text
         * @memberof ChatMessage.ReplyTo
         * @instance
         */
        ReplyTo.prototype.text = "";

        /**
         * ReplyTo fromUserId.
         * @member {number} fromUserId
         * @memberof ChatMessage.ReplyTo
         * @instance
         */
        ReplyTo.prototype.fromUserId = 0;

        /**
         * Creates a new ReplyTo instance using the specified properties.
         * @function create
         * @memberof ChatMessage.ReplyTo
         * @static
         * @param {ChatMessage.IReplyTo=} [properties] Properties to set
         * @returns {ChatMessage.ReplyTo} ReplyTo instance
         */
        ReplyTo.create = function create(properties) {
            return new ReplyTo(properties);
        };

        /**
         * Encodes the specified ReplyTo message. Does not implicitly {@link ChatMessage.ReplyTo.verify|verify} messages.
         * @function encode
         * @memberof ChatMessage.ReplyTo
         * @static
         * @param {ChatMessage.IReplyTo} message ReplyTo message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ReplyTo.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.id);
            if (message.text != null && Object.hasOwnProperty.call(message, "text"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.text);
            if (message.fromUserId != null && Object.hasOwnProperty.call(message, "fromUserId"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.fromUserId);
            return writer;
        };

        /**
         * Encodes the specified ReplyTo message, length delimited. Does not implicitly {@link ChatMessage.ReplyTo.verify|verify} messages.
         * @function encodeDelimited
         * @memberof ChatMessage.ReplyTo
         * @static
         * @param {ChatMessage.IReplyTo} message ReplyTo message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ReplyTo.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ReplyTo message from the specified reader or buffer.
         * @function decode
         * @memberof ChatMessage.ReplyTo
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {ChatMessage.ReplyTo} ReplyTo
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ReplyTo.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ChatMessage.ReplyTo();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.id = reader.int32();
                    break;
                case 2:
                    message.text = reader.string();
                    break;
                case 3:
                    message.fromUserId = reader.int32();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ReplyTo message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof ChatMessage.ReplyTo
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {ChatMessage.ReplyTo} ReplyTo
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ReplyTo.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ReplyTo message.
         * @function verify
         * @memberof ChatMessage.ReplyTo
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ReplyTo.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.id != null && message.hasOwnProperty("id"))
                if (!$util.isInteger(message.id))
                    return "id: integer expected";
            if (message.text != null && message.hasOwnProperty("text"))
                if (!$util.isString(message.text))
                    return "text: string expected";
            if (message.fromUserId != null && message.hasOwnProperty("fromUserId"))
                if (!$util.isInteger(message.fromUserId))
                    return "fromUserId: integer expected";
            return null;
        };

        /**
         * Creates a ReplyTo message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof ChatMessage.ReplyTo
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {ChatMessage.ReplyTo} ReplyTo
         */
        ReplyTo.fromObject = function fromObject(object) {
            if (object instanceof $root.ChatMessage.ReplyTo)
                return object;
            var message = new $root.ChatMessage.ReplyTo();
            if (object.id != null)
                message.id = object.id | 0;
            if (object.text != null)
                message.text = String(object.text);
            if (object.fromUserId != null)
                message.fromUserId = object.fromUserId | 0;
            return message;
        };

        /**
         * Creates a plain object from a ReplyTo message. Also converts values to other types if specified.
         * @function toObject
         * @memberof ChatMessage.ReplyTo
         * @static
         * @param {ChatMessage.ReplyTo} message ReplyTo
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ReplyTo.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.id = 0;
                object.text = "";
                object.fromUserId = 0;
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.text != null && message.hasOwnProperty("text"))
                object.text = message.text;
            if (message.fromUserId != null && message.hasOwnProperty("fromUserId"))
                object.fromUserId = message.fromUserId;
            return object;
        };

        /**
         * Converts this ReplyTo to JSON.
         * @function toJSON
         * @memberof ChatMessage.ReplyTo
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ReplyTo.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return ReplyTo;
    })();

    return ChatMessage;
})();

$root.Reaction = (function() {

    /**
     * Properties of a Reaction.
     * @exports IReaction
     * @interface IReaction
     * @property {number|null} [messageId] Reaction messageId
     * @property {number|null} [userId] Reaction userId
     * @property {string|null} [emoji] Reaction emoji
     */

    /**
     * Constructs a new Reaction.
     * @exports Reaction
     * @classdesc Represents a Reaction.
     * @implements IReaction
     * @constructor
     * @param {IReaction=} [properties] Properties to set
     */
    function Reaction(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Reaction messageId.
     * @member {number} messageId
     * @memberof Reaction
     * @instance
     */
    Reaction.prototype.messageId = 0;

    /**
     * Reaction userId.
     * @member {number} userId
     * @memberof Reaction
     * @instance
     */
    Reaction.prototype.userId = 0;

    /**
     * Reaction emoji.
     * @member {string} emoji
     * @memberof Reaction
     * @instance
     */
    Reaction.prototype.emoji = "";

    /**
     * Creates a new Reaction instance using the specified properties.
     * @function create
     * @memberof Reaction
     * @static
     * @param {IReaction=} [properties] Properties to set
     * @returns {Reaction} Reaction instance
     */
    Reaction.create = function create(properties) {
        return new Reaction(properties);
    };

    /**
     * Encodes the specified Reaction message. Does not implicitly {@link Reaction.verify|verify} messages.
     * @function encode
     * @memberof Reaction
     * @static
     * @param {IReaction} message Reaction message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Reaction.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.messageId != null && Object.hasOwnProperty.call(message, "messageId"))
            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.messageId);
        if (message.userId != null && Object.hasOwnProperty.call(message, "userId"))
            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.userId);
        if (message.emoji != null && Object.hasOwnProperty.call(message, "emoji"))
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.emoji);
        return writer;
    };

    /**
     * Encodes the specified Reaction message, length delimited. Does not implicitly {@link Reaction.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Reaction
     * @static
     * @param {IReaction} message Reaction message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Reaction.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Reaction message from the specified reader or buffer.
     * @function decode
     * @memberof Reaction
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Reaction} Reaction
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Reaction.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Reaction();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.messageId = reader.int32();
                break;
            case 2:
                message.userId = reader.int32();
                break;
            case 3:
                message.emoji = reader.string();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Reaction message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Reaction
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Reaction} Reaction
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Reaction.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Reaction message.
     * @function verify
     * @memberof Reaction
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Reaction.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.messageId != null && message.hasOwnProperty("messageId"))
            if (!$util.isInteger(message.messageId))
                return "messageId: integer expected";
        if (message.userId != null && message.hasOwnProperty("userId"))
            if (!$util.isInteger(message.userId))
                return "userId: integer expected";
        if (message.emoji != null && message.hasOwnProperty("emoji"))
            if (!$util.isString(message.emoji))
                return "emoji: string expected";
        return null;
    };

    /**
     * Creates a Reaction message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Reaction
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Reaction} Reaction
     */
    Reaction.fromObject = function fromObject(object) {
        if (object instanceof $root.Reaction)
            return object;
        var message = new $root.Reaction();
        if (object.messageId != null)
            message.messageId = object.messageId | 0;
        if (object.userId != null)
            message.userId = object.userId | 0;
        if (object.emoji != null)
            message.emoji = String(object.emoji);
        return message;
    };

    /**
     * Creates a plain object from a Reaction message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Reaction
     * @static
     * @param {Reaction} message Reaction
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Reaction.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.messageId = 0;
            object.userId = 0;
            object.emoji = "";
        }
        if (message.messageId != null && message.hasOwnProperty("messageId"))
            object.messageId = message.messageId;
        if (message.userId != null && message.hasOwnProperty("userId"))
            object.userId = message.userId;
        if (message.emoji != null && message.hasOwnProperty("emoji"))
            object.emoji = message.emoji;
        return object;
    };

    /**
     * Converts this Reaction to JSON.
     * @function toJSON
     * @memberof Reaction
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Reaction.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Reaction;
})();

module.exports = $root;
