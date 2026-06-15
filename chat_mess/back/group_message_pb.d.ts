import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace chat. */
export namespace chat {

    /** Properties of a Sender. */
    interface ISender {

        /** Sender id */
        id?: (number|null);

        /** Sender username */
        username?: (string|null);
    }

    /** Represents a Sender. */
    class Sender implements ISender {

        /**
         * Constructs a new Sender.
         * @param [properties] Properties to set
         */
        constructor(properties?: chat.ISender);

        /** Sender id. */
        public id: number;

        /** Sender username. */
        public username: string;

        /**
         * Creates a new Sender instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Sender instance
         */
        public static create(properties?: chat.ISender): chat.Sender;

        /**
         * Encodes the specified Sender message. Does not implicitly {@link chat.Sender.verify|verify} messages.
         * @param message Sender message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: chat.ISender, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Sender message, length delimited. Does not implicitly {@link chat.Sender.verify|verify} messages.
         * @param message Sender message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: chat.ISender, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Sender message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Sender
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): chat.Sender;

        /**
         * Decodes a Sender message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Sender
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): chat.Sender;

        /**
         * Verifies a Sender message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Sender message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Sender
         */
        public static fromObject(object: { [k: string]: any }): chat.Sender;

        /**
         * Creates a plain object from a Sender message. Also converts values to other types if specified.
         * @param message Sender
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: chat.Sender, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Sender to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Sender
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GroupMessage. */
    interface IGroupMessage {

        /** GroupMessage id */
        id?: (number|null);

        /** GroupMessage groupId */
        groupId?: (number|null);

        /** GroupMessage userId */
        userId?: (number|null);

        /** GroupMessage text */
        text?: (string|null);

        /** GroupMessage type */
        type?: (string|null);

        /** GroupMessage fileUrl */
        fileUrl?: (string|null);

        /** GroupMessage filename */
        filename?: (string|null);

        /** GroupMessage replyToId */
        replyToId?: (number|null);

        /** GroupMessage sender */
        sender?: (chat.ISender|null);

        /** GroupMessage isDeleted */
        isDeleted?: (boolean|null);

        /** GroupMessage createdAt */
        createdAt?: (number|Long|null);

        /** GroupMessage updatedAt */
        updatedAt?: (number|Long|null);

        /** GroupMessage repliedMessage */
        repliedMessage?: (chat.IGroupMessage|null);
    }

    /** Represents a GroupMessage. */
    class GroupMessage implements IGroupMessage {

        /**
         * Constructs a new GroupMessage.
         * @param [properties] Properties to set
         */
        constructor(properties?: chat.IGroupMessage);

        /** GroupMessage id. */
        public id: number;

        /** GroupMessage groupId. */
        public groupId: number;

        /** GroupMessage userId. */
        public userId: number;

        /** GroupMessage text. */
        public text: string;

        /** GroupMessage type. */
        public type: string;

        /** GroupMessage fileUrl. */
        public fileUrl: string;

        /** GroupMessage filename. */
        public filename: string;

        /** GroupMessage replyToId. */
        public replyToId: number;

        /** GroupMessage sender. */
        public sender?: (chat.ISender|null);

        /** GroupMessage isDeleted. */
        public isDeleted: boolean;

        /** GroupMessage createdAt. */
        public createdAt: (number|Long);

        /** GroupMessage updatedAt. */
        public updatedAt: (number|Long);

        /** GroupMessage repliedMessage. */
        public repliedMessage?: (chat.IGroupMessage|null);

        /**
         * Creates a new GroupMessage instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GroupMessage instance
         */
        public static create(properties?: chat.IGroupMessage): chat.GroupMessage;

        /**
         * Encodes the specified GroupMessage message. Does not implicitly {@link chat.GroupMessage.verify|verify} messages.
         * @param message GroupMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: chat.IGroupMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GroupMessage message, length delimited. Does not implicitly {@link chat.GroupMessage.verify|verify} messages.
         * @param message GroupMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: chat.IGroupMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GroupMessage message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GroupMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): chat.GroupMessage;

        /**
         * Decodes a GroupMessage message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GroupMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): chat.GroupMessage;

        /**
         * Verifies a GroupMessage message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GroupMessage message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GroupMessage
         */
        public static fromObject(object: { [k: string]: any }): chat.GroupMessage;

        /**
         * Creates a plain object from a GroupMessage message. Also converts values to other types if specified.
         * @param message GroupMessage
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: chat.GroupMessage, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GroupMessage to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GroupMessage
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GroupMessageList. */
    interface IGroupMessageList {

        /** GroupMessageList messages */
        messages?: (chat.IGroupMessage[]|null);
    }

    /** Represents a GroupMessageList. */
    class GroupMessageList implements IGroupMessageList {

        /**
         * Constructs a new GroupMessageList.
         * @param [properties] Properties to set
         */
        constructor(properties?: chat.IGroupMessageList);

        /** GroupMessageList messages. */
        public messages: chat.IGroupMessage[];

        /**
         * Creates a new GroupMessageList instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GroupMessageList instance
         */
        public static create(properties?: chat.IGroupMessageList): chat.GroupMessageList;

        /**
         * Encodes the specified GroupMessageList message. Does not implicitly {@link chat.GroupMessageList.verify|verify} messages.
         * @param message GroupMessageList message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: chat.IGroupMessageList, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GroupMessageList message, length delimited. Does not implicitly {@link chat.GroupMessageList.verify|verify} messages.
         * @param message GroupMessageList message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: chat.IGroupMessageList, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GroupMessageList message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GroupMessageList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): chat.GroupMessageList;

        /**
         * Decodes a GroupMessageList message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GroupMessageList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): chat.GroupMessageList;

        /**
         * Verifies a GroupMessageList message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GroupMessageList message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GroupMessageList
         */
        public static fromObject(object: { [k: string]: any }): chat.GroupMessageList;

        /**
         * Creates a plain object from a GroupMessageList message. Also converts values to other types if specified.
         * @param message GroupMessageList
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: chat.GroupMessageList, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GroupMessageList to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GroupMessageList
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}
