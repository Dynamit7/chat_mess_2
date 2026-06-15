/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.chat = (function() {

    /**
     * Namespace chat.
     * @exports chat
     * @namespace
     */
    var chat = {};

    chat.Sender = (function() {

        /**
         * Properties of a Sender.
         * @memberof chat
         * @interface ISender
         * @property {number|null} [id] Sender id
         * @property {string|null} [username] Sender username
         */

        /**
         * Constructs a new Sender.
         * @memberof chat
         * @classdesc Represents a Sender.
         * @implements ISender
         * @constructor
         * @param {chat.ISender=} [properties] Properties to set
         */
        function Sender(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Sender id.
         * @member {number} id
         * @memberof chat.Sender
         * @instance
         */
        Sender.prototype.id = 0;

        /**
         * Sender username.
         * @member {string} username
         * @memberof chat.Sender
         * @instance
         */
        Sender.prototype.username = "";

        /**
         * Creates a new Sender instance using the specified properties.
         * @function create
         * @memberof chat.Sender
         * @static
         * @param {chat.ISender=} [properties] Properties to set
         * @returns {chat.Sender} Sender instance
         */
        Sender.create = function create(properties) {
            return new Sender(properties);
        };

        /**
         * Encodes the specified Sender message. Does not implicitly {@link chat.Sender.verify|verify} messages.
         * @function encode
         * @memberof chat.Sender
         * @static
         * @param {chat.ISender} message Sender message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Sender.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.id);
            if (message.username != null && Object.hasOwnProperty.call(message, "username"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.username);
            return writer;
        };

        /**
         * Encodes the specified Sender message, length delimited. Does not implicitly {@link chat.Sender.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chat.Sender
         * @static
         * @param {chat.ISender} message Sender message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Sender.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Sender message from the specified reader or buffer.
         * @function decode
         * @memberof chat.Sender
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chat.Sender} Sender
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Sender.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.chat.Sender();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.int32();
                        break;
                    }
                case 2: {
                        message.username = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Sender message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chat.Sender
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chat.Sender} Sender
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Sender.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Sender message.
         * @function verify
         * @memberof chat.Sender
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Sender.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.id != null && message.hasOwnProperty("id"))
                if (!$util.isInteger(message.id))
                    return "id: integer expected";
            if (message.username != null && message.hasOwnProperty("username"))
                if (!$util.isString(message.username))
                    return "username: string expected";
            return null;
        };

        /**
         * Creates a Sender message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chat.Sender
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chat.Sender} Sender
         */
        Sender.fromObject = function fromObject(object) {
            if (object instanceof $root.chat.Sender)
                return object;
            var message = new $root.chat.Sender();
            if (object.id != null)
                message.id = object.id | 0;
            if (object.username != null)
                message.username = String(object.username);
            return message;
        };

        /**
         * Creates a plain object from a Sender message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chat.Sender
         * @static
         * @param {chat.Sender} message Sender
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Sender.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.id = 0;
                object.username = "";
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.username != null && message.hasOwnProperty("username"))
                object.username = message.username;
            return object;
        };

        /**
         * Converts this Sender to JSON.
         * @function toJSON
         * @memberof chat.Sender
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Sender.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Sender
         * @function getTypeUrl
         * @memberof chat.Sender
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Sender.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chat.Sender";
        };

        return Sender;
    })();

    chat.GroupMessage = (function() {

        /**
         * Properties of a GroupMessage.
         * @memberof chat
         * @interface IGroupMessage
         * @property {number|null} [id] GroupMessage id
         * @property {number|null} [groupId] GroupMessage groupId
         * @property {number|null} [userId] GroupMessage userId
         * @property {string|null} [text] GroupMessage text
         * @property {string|null} [type] GroupMessage type
         * @property {string|null} [fileUrl] GroupMessage fileUrl
         * @property {string|null} [filename] GroupMessage filename
         * @property {number|null} [replyToId] GroupMessage replyToId
         * @property {chat.ISender|null} [sender] GroupMessage sender
         * @property {boolean|null} [isDeleted] GroupMessage isDeleted
         * @property {number|Long|null} [createdAt] GroupMessage createdAt
         * @property {number|Long|null} [updatedAt] GroupMessage updatedAt
         * @property {chat.IGroupMessage|null} [repliedMessage] GroupMessage repliedMessage
         * @property {string|null} [forwardedFromType] GroupMessage forwardedFromType
         * @property {number|null} [forwardedFromId] GroupMessage forwardedFromId
         * @property {string|null} [forwardedFromUsername] GroupMessage forwardedFromUsername
         */

        /**
         * Constructs a new GroupMessage.
         * @memberof chat
         * @classdesc Represents a GroupMessage.
         * @implements IGroupMessage
         * @constructor
         * @param {chat.IGroupMessage=} [properties] Properties to set
         */
        function GroupMessage(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GroupMessage id.
         * @member {number} id
         * @memberof chat.GroupMessage
         * @instance
         */
        GroupMessage.prototype.id = 0;

        /**
         * GroupMessage groupId.
         * @member {number} groupId
         * @memberof chat.GroupMessage
         * @instance
         */
        GroupMessage.prototype.groupId = 0;

        /**
         * GroupMessage userId.
         * @member {number} userId
         * @memberof chat.GroupMessage
         * @instance
         */
        GroupMessage.prototype.userId = 0;

        /**
         * GroupMessage text.
         * @member {string} text
         * @memberof chat.GroupMessage
         * @instance
         */
        GroupMessage.prototype.text = "";

        /**
         * GroupMessage type.
         * @member {string} type
         * @memberof chat.GroupMessage
         * @instance
         */
        GroupMessage.prototype.type = "";

        /**
         * GroupMessage fileUrl.
         * @member {string} fileUrl
         * @memberof chat.GroupMessage
         * @instance
         */
        GroupMessage.prototype.fileUrl = "";

        /**
         * GroupMessage filename.
         * @member {string} filename
         * @memberof chat.GroupMessage
         * @instance
         */
        GroupMessage.prototype.filename = "";

        /**
         * GroupMessage replyToId.
         * @member {number} replyToId
         * @memberof chat.GroupMessage
         * @instance
         */
        GroupMessage.prototype.replyToId = 0;

        /**
         * GroupMessage sender.
         * @member {chat.ISender|null|undefined} sender
         * @memberof chat.GroupMessage
         * @instance
         */
        GroupMessage.prototype.sender = null;

        /**
         * GroupMessage isDeleted.
         * @member {boolean} isDeleted
         * @memberof chat.GroupMessage
         * @instance
         */
        GroupMessage.prototype.isDeleted = false;

        /**
         * GroupMessage createdAt.
         * @member {number|Long} createdAt
         * @memberof chat.GroupMessage
         * @instance
         */
        GroupMessage.prototype.createdAt = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * GroupMessage updatedAt.
         * @member {number|Long} updatedAt
         * @memberof chat.GroupMessage
         * @instance
         */
        GroupMessage.prototype.updatedAt = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * GroupMessage repliedMessage.
         * @member {chat.IGroupMessage|null|undefined} repliedMessage
         * @memberof chat.GroupMessage
         * @instance
         */
        GroupMessage.prototype.repliedMessage = null;

        GroupMessage.prototype.forwardedFromType = "";
        GroupMessage.prototype.forwardedFromId = 0;
        GroupMessage.prototype.forwardedFromUsername = "";
        GroupMessage.prototype.readBy = $util.emptyArray;

        /**
         * Creates a new GroupMessage instance using the specified properties.
         * @function create
         * @memberof chat.GroupMessage
         * @static
         * @param {chat.IGroupMessage=} [properties] Properties to set
         * @returns {chat.GroupMessage} GroupMessage instance
         */
        GroupMessage.create = function create(properties) {
            return new GroupMessage(properties);
        };

        /**
         * Encodes the specified GroupMessage message. Does not implicitly {@link chat.GroupMessage.verify|verify} messages.
         * @function encode
         * @memberof chat.GroupMessage
         * @static
         * @param {chat.IGroupMessage} message GroupMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GroupMessage.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.id);
            if (message.groupId != null && Object.hasOwnProperty.call(message, "groupId"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.groupId);
            if (message.userId != null && Object.hasOwnProperty.call(message, "userId"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.userId);
            if (message.text != null && Object.hasOwnProperty.call(message, "text"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.text);
            if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.type);
            if (message.fileUrl != null && Object.hasOwnProperty.call(message, "fileUrl"))
                writer.uint32(/* id 6, wireType 2 =*/50).string(message.fileUrl);
            if (message.filename != null && Object.hasOwnProperty.call(message, "filename"))
                writer.uint32(/* id 7, wireType 2 =*/58).string(message.filename);
            if (message.replyToId != null && Object.hasOwnProperty.call(message, "replyToId"))
                writer.uint32(/* id 8, wireType 0 =*/64).int32(message.replyToId);
            if (message.sender != null && Object.hasOwnProperty.call(message, "sender"))
                $root.chat.Sender.encode(message.sender, writer.uint32(/* id 9, wireType 2 =*/74).fork()).ldelim();
            if (message.isDeleted != null && Object.hasOwnProperty.call(message, "isDeleted"))
                writer.uint32(/* id 10, wireType 0 =*/80).bool(message.isDeleted);
            if (message.createdAt != null && Object.hasOwnProperty.call(message, "createdAt"))
                writer.uint32(/* id 11, wireType 0 =*/88).int64(message.createdAt);
            if (message.updatedAt != null && Object.hasOwnProperty.call(message, "updatedAt"))
                writer.uint32(/* id 12, wireType 0 =*/96).int64(message.updatedAt);
            if (message.repliedMessage != null && Object.hasOwnProperty.call(message, "repliedMessage"))
                $root.chat.GroupMessage.encode(message.repliedMessage, writer.uint32(/* id 13, wireType 2 =*/106).fork()).ldelim();
            if (message.forwardedFromType != null && Object.hasOwnProperty.call(message, "forwardedFromType"))
                writer.uint32(/* id 14, wireType 2 =*/114).string(message.forwardedFromType);
            if (message.forwardedFromId != null && Object.hasOwnProperty.call(message, "forwardedFromId"))
                writer.uint32(/* id 15, wireType 0 =*/120).int32(message.forwardedFromId);
            if (message.forwardedFromUsername != null && Object.hasOwnProperty.call(message, "forwardedFromUsername"))
                writer.uint32(/* id 16, wireType 2 =*/130).string(message.forwardedFromUsername);
            if (message.readBy != null && message.readBy.length) {
                writer.uint32(/* id 17, wireType 2 =*/138).fork();
                for (var i = 0; i < message.readBy.length; ++i)
                    writer.int32(message.readBy[i]);
                writer.ldelim();
            }
            return writer;
        };

        /**
         * Encodes the specified GroupMessage message, length delimited. Does not implicitly {@link chat.GroupMessage.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chat.GroupMessage
         * @static
         * @param {chat.IGroupMessage} message GroupMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GroupMessage.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GroupMessage message from the specified reader or buffer.
         * @function decode
         * @memberof chat.GroupMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chat.GroupMessage} GroupMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GroupMessage.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.chat.GroupMessage();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.int32();
                        break;
                    }
                case 2: {
                        message.groupId = reader.int32();
                        break;
                    }
                case 3: {
                        message.userId = reader.int32();
                        break;
                    }
                case 4: {
                        message.text = reader.string();
                        break;
                    }
                case 5: {
                        message.type = reader.string();
                        break;
                    }
                case 6: {
                        message.fileUrl = reader.string();
                        break;
                    }
                case 7: {
                        message.filename = reader.string();
                        break;
                    }
                case 8: {
                        message.replyToId = reader.int32();
                        break;
                    }
                case 9: {
                        message.sender = $root.chat.Sender.decode(reader, reader.uint32());
                        break;
                    }
                case 10: {
                        message.isDeleted = reader.bool();
                        break;
                    }
                case 11: {
                        message.createdAt = reader.int64();
                        break;
                    }
                case 12: {
                        message.updatedAt = reader.int64();
                        break;
                    }
                case 13: {
                        message.repliedMessage = $root.chat.GroupMessage.decode(reader, reader.uint32());
                        break;
                    }
                case 14: {
                        message.forwardedFromType = reader.string();
                        break;
                    }
                case 15: {
                        message.forwardedFromId = reader.int32();
                        break;
                    }
                case 16: {
                        message.forwardedFromUsername = reader.string();
                        break;
                    }
                case 17: {
                        if (!(message.readBy && message.readBy.length))
                            message.readBy = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.readBy.push(reader.int32());
                        } else
                            message.readBy.push(reader.int32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a GroupMessage message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chat.GroupMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chat.GroupMessage} GroupMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GroupMessage.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GroupMessage message.
         * @function verify
         * @memberof chat.GroupMessage
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GroupMessage.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.id != null && message.hasOwnProperty("id"))
                if (!$util.isInteger(message.id))
                    return "id: integer expected";
            if (message.groupId != null && message.hasOwnProperty("groupId"))
                if (!$util.isInteger(message.groupId))
                    return "groupId: integer expected";
            if (message.userId != null && message.hasOwnProperty("userId"))
                if (!$util.isInteger(message.userId))
                    return "userId: integer expected";
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
            if (message.replyToId != null && message.hasOwnProperty("replyToId"))
                if (!$util.isInteger(message.replyToId))
                    return "replyToId: integer expected";
            if (message.sender != null && message.hasOwnProperty("sender")) {
                var error = $root.chat.Sender.verify(message.sender);
                if (error)
                    return "sender." + error;
            }
            if (message.isDeleted != null && message.hasOwnProperty("isDeleted"))
                if (typeof message.isDeleted !== "boolean")
                    return "isDeleted: boolean expected";
            if (message.createdAt != null && message.hasOwnProperty("createdAt"))
                if (!$util.isInteger(message.createdAt) && !(message.createdAt && $util.isInteger(message.createdAt.low) && $util.isInteger(message.createdAt.high)))
                    return "createdAt: integer|Long expected";
            if (message.updatedAt != null && message.hasOwnProperty("updatedAt"))
                if (!$util.isInteger(message.updatedAt) && !(message.updatedAt && $util.isInteger(message.updatedAt.low) && $util.isInteger(message.updatedAt.high)))
                    return "updatedAt: integer|Long expected";
            if (message.repliedMessage != null && message.hasOwnProperty("repliedMessage")) {
                var error = $root.chat.GroupMessage.verify(message.repliedMessage);
                if (error)
                    return "repliedMessage." + error;
            }
            if (message.forwardedFromType != null && message.hasOwnProperty("forwardedFromType"))
                if (!$util.isString(message.forwardedFromType))
                    return "forwardedFromType: string expected";
            if (message.forwardedFromId != null && message.hasOwnProperty("forwardedFromId"))
                if (!$util.isInteger(message.forwardedFromId))
                    return "forwardedFromId: integer expected";
            if (message.forwardedFromUsername != null && message.hasOwnProperty("forwardedFromUsername"))
                if (!$util.isString(message.forwardedFromUsername))
                    return "forwardedFromUsername: string expected";
            if (message.readBy != null && message.hasOwnProperty("readBy")) {
                if (!Array.isArray(message.readBy))
                    return "readBy: array expected";
                for (var i = 0; i < message.readBy.length; ++i)
                    if (!$util.isInteger(message.readBy[i]))
                        return "readBy: integer[] expected";
            }
            return null;
        };

        /**
         * Creates a GroupMessage message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chat.GroupMessage
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chat.GroupMessage} GroupMessage
         */
        GroupMessage.fromObject = function fromObject(object) {
            if (object instanceof $root.chat.GroupMessage)
                return object;
            var message = new $root.chat.GroupMessage();
            if (object.id != null)
                message.id = object.id | 0;
            if (object.groupId != null)
                message.groupId = object.groupId | 0;
            if (object.userId != null)
                message.userId = object.userId | 0;
            if (object.text != null)
                message.text = String(object.text);
            if (object.type != null)
                message.type = String(object.type);
            if (object.fileUrl != null)
                message.fileUrl = String(object.fileUrl);
            if (object.filename != null)
                message.filename = String(object.filename);
            if (object.replyToId != null)
                message.replyToId = object.replyToId | 0;
            if (object.sender != null) {
                if (typeof object.sender !== "object")
                    throw TypeError(".chat.GroupMessage.sender: object expected");
                message.sender = $root.chat.Sender.fromObject(object.sender);
            }
            if (object.isDeleted != null)
                message.isDeleted = Boolean(object.isDeleted);
            if (object.createdAt != null)
                if ($util.Long)
                    (message.createdAt = $util.Long.fromValue(object.createdAt)).unsigned = false;
                else if (typeof object.createdAt === "string")
                    message.createdAt = parseInt(object.createdAt, 10);
                else if (typeof object.createdAt === "number")
                    message.createdAt = object.createdAt;
                else if (typeof object.createdAt === "object")
                    message.createdAt = new $util.LongBits(object.createdAt.low >>> 0, object.createdAt.high >>> 0).toNumber();
            if (object.updatedAt != null)
                if ($util.Long)
                    (message.updatedAt = $util.Long.fromValue(object.updatedAt)).unsigned = false;
                else if (typeof object.updatedAt === "string")
                    message.updatedAt = parseInt(object.updatedAt, 10);
                else if (typeof object.updatedAt === "number")
                    message.updatedAt = object.updatedAt;
                else if (typeof object.updatedAt === "object")
                    message.updatedAt = new $util.LongBits(object.updatedAt.low >>> 0, object.updatedAt.high >>> 0).toNumber();
            if (object.repliedMessage != null) {
                if (typeof object.repliedMessage !== "object")
                    throw TypeError(".chat.GroupMessage.repliedMessage: object expected");
                message.repliedMessage = $root.chat.GroupMessage.fromObject(object.repliedMessage);
            }
            if (object.forwardedFromType != null)
                message.forwardedFromType = String(object.forwardedFromType);
            if (object.forwardedFromId != null)
                message.forwardedFromId = object.forwardedFromId | 0;
            if (object.forwardedFromUsername != null)
                message.forwardedFromUsername = String(object.forwardedFromUsername);
            if (object.readBy) {
                if (!Array.isArray(object.readBy))
                    throw TypeError(".chat.GroupMessage.readBy: array expected");
                message.readBy = [];
                for (var i = 0; i < object.readBy.length; ++i)
                    message.readBy[i] = object.readBy[i] | 0;
            }
            return message;
        };

        /**
         * Creates a plain object from a GroupMessage message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chat.GroupMessage
         * @static
         * @param {chat.GroupMessage} message GroupMessage
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GroupMessage.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.id = 0;
                object.groupId = 0;
                object.userId = 0;
                object.text = "";
                object.type = "";
                object.fileUrl = "";
                object.filename = "";
                object.replyToId = 0;
                object.sender = null;
                object.isDeleted = false;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, false);
                    object.createdAt = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.createdAt = options.longs === String ? "0" : 0;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, false);
                    object.updatedAt = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.updatedAt = options.longs === String ? "0" : 0;
                object.repliedMessage = null;
                object.forwardedFromType = "";
                object.forwardedFromId = 0;
                object.forwardedFromUsername = "";
                object.readBy = [];
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.groupId != null && message.hasOwnProperty("groupId"))
                object.groupId = message.groupId;
            if (message.userId != null && message.hasOwnProperty("userId"))
                object.userId = message.userId;
            if (message.text != null && message.hasOwnProperty("text"))
                object.text = message.text;
            if (message.type != null && message.hasOwnProperty("type"))
                object.type = message.type;
            if (message.fileUrl != null && message.hasOwnProperty("fileUrl"))
                object.fileUrl = message.fileUrl;
            if (message.filename != null && message.hasOwnProperty("filename"))
                object.filename = message.filename;
            if (message.replyToId != null && message.hasOwnProperty("replyToId"))
                object.replyToId = message.replyToId;
            if (message.sender != null && message.hasOwnProperty("sender"))
                object.sender = $root.chat.Sender.toObject(message.sender, options);
            if (message.isDeleted != null && message.hasOwnProperty("isDeleted"))
                object.isDeleted = message.isDeleted;
            if (message.createdAt != null && message.hasOwnProperty("createdAt"))
                if (typeof message.createdAt === "number")
                    object.createdAt = options.longs === String ? String(message.createdAt) : message.createdAt;
                else
                    object.createdAt = options.longs === String ? $util.Long.prototype.toString.call(message.createdAt) : options.longs === Number ? new $util.LongBits(message.createdAt.low >>> 0, message.createdAt.high >>> 0).toNumber() : message.createdAt;
            if (message.updatedAt != null && message.hasOwnProperty("updatedAt"))
                if (typeof message.updatedAt === "number")
                    object.updatedAt = options.longs === String ? String(message.updatedAt) : message.updatedAt;
                else
                    object.updatedAt = options.longs === String ? $util.Long.prototype.toString.call(message.updatedAt) : options.longs === Number ? new $util.LongBits(message.updatedAt.low >>> 0, message.updatedAt.high >>> 0).toNumber() : message.updatedAt;
            if (message.repliedMessage != null && message.hasOwnProperty("repliedMessage"))
                object.repliedMessage = $root.chat.GroupMessage.toObject(message.repliedMessage, options);
            if (message.forwardedFromType != null && message.hasOwnProperty("forwardedFromType"))
                object.forwardedFromType = message.forwardedFromType;
            if (message.forwardedFromId != null && message.hasOwnProperty("forwardedFromId"))
                object.forwardedFromId = message.forwardedFromId;
            if (message.forwardedFromUsername != null && message.hasOwnProperty("forwardedFromUsername"))
                object.forwardedFromUsername = message.forwardedFromUsername;
            if (message.readBy && message.readBy.length) {
                object.readBy = [];
                for (var j = 0; j < message.readBy.length; ++j)
                    object.readBy[j] = message.readBy[j];
            }
            return object;
        };

        /**
         * Converts this GroupMessage to JSON.
         * @function toJSON
         * @memberof chat.GroupMessage
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GroupMessage.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for GroupMessage
         * @function getTypeUrl
         * @memberof chat.GroupMessage
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        GroupMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chat.GroupMessage";
        };

        return GroupMessage;
    })();

    chat.GroupMessageList = (function() {

        /**
         * Properties of a GroupMessageList.
         * @memberof chat
         * @interface IGroupMessageList
         * @property {Array.<chat.IGroupMessage>|null} [messages] GroupMessageList messages
         */

        /**
         * Constructs a new GroupMessageList.
         * @memberof chat
         * @classdesc Represents a GroupMessageList.
         * @implements IGroupMessageList
         * @constructor
         * @param {chat.IGroupMessageList=} [properties] Properties to set
         */
        function GroupMessageList(properties) {
            this.messages = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GroupMessageList messages.
         * @member {Array.<chat.IGroupMessage>} messages
         * @memberof chat.GroupMessageList
         * @instance
         */
        GroupMessageList.prototype.messages = $util.emptyArray;

        /**
         * Creates a new GroupMessageList instance using the specified properties.
         * @function create
         * @memberof chat.GroupMessageList
         * @static
         * @param {chat.IGroupMessageList=} [properties] Properties to set
         * @returns {chat.GroupMessageList} GroupMessageList instance
         */
        GroupMessageList.create = function create(properties) {
            return new GroupMessageList(properties);
        };

        /**
         * Encodes the specified GroupMessageList message. Does not implicitly {@link chat.GroupMessageList.verify|verify} messages.
         * @function encode
         * @memberof chat.GroupMessageList
         * @static
         * @param {chat.IGroupMessageList} message GroupMessageList message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GroupMessageList.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.messages != null && message.messages.length)
                for (var i = 0; i < message.messages.length; ++i)
                    $root.chat.GroupMessage.encode(message.messages[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified GroupMessageList message, length delimited. Does not implicitly {@link chat.GroupMessageList.verify|verify} messages.
         * @function encodeDelimited
         * @memberof chat.GroupMessageList
         * @static
         * @param {chat.IGroupMessageList} message GroupMessageList message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GroupMessageList.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GroupMessageList message from the specified reader or buffer.
         * @function decode
         * @memberof chat.GroupMessageList
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {chat.GroupMessageList} GroupMessageList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GroupMessageList.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.chat.GroupMessageList();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.messages && message.messages.length))
                            message.messages = [];
                        message.messages.push($root.chat.GroupMessage.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a GroupMessageList message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof chat.GroupMessageList
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {chat.GroupMessageList} GroupMessageList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GroupMessageList.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GroupMessageList message.
         * @function verify
         * @memberof chat.GroupMessageList
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GroupMessageList.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.messages != null && message.hasOwnProperty("messages")) {
                if (!Array.isArray(message.messages))
                    return "messages: array expected";
                for (var i = 0; i < message.messages.length; ++i) {
                    var error = $root.chat.GroupMessage.verify(message.messages[i]);
                    if (error)
                        return "messages." + error;
                }
            }
            return null;
        };

        /**
         * Creates a GroupMessageList message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof chat.GroupMessageList
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {chat.GroupMessageList} GroupMessageList
         */
        GroupMessageList.fromObject = function fromObject(object) {
            if (object instanceof $root.chat.GroupMessageList)
                return object;
            var message = new $root.chat.GroupMessageList();
            if (object.messages) {
                if (!Array.isArray(object.messages))
                    throw TypeError(".chat.GroupMessageList.messages: array expected");
                message.messages = [];
                for (var i = 0; i < object.messages.length; ++i) {
                    if (typeof object.messages[i] !== "object")
                        throw TypeError(".chat.GroupMessageList.messages: object expected");
                    message.messages[i] = $root.chat.GroupMessage.fromObject(object.messages[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a GroupMessageList message. Also converts values to other types if specified.
         * @function toObject
         * @memberof chat.GroupMessageList
         * @static
         * @param {chat.GroupMessageList} message GroupMessageList
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GroupMessageList.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.messages = [];
            if (message.messages && message.messages.length) {
                object.messages = [];
                for (var j = 0; j < message.messages.length; ++j)
                    object.messages[j] = $root.chat.GroupMessage.toObject(message.messages[j], options);
            }
            return object;
        };

        /**
         * Converts this GroupMessageList to JSON.
         * @function toJSON
         * @memberof chat.GroupMessageList
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GroupMessageList.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for GroupMessageList
         * @function getTypeUrl
         * @memberof chat.GroupMessageList
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        GroupMessageList.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/chat.GroupMessageList";
        };

        return GroupMessageList;
    })();

    return chat;
})();

module.exports = $root;
