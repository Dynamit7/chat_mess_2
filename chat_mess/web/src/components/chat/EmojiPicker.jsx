import { useState, useEffect, useRef } from "react";

// Лёгкий пикер эмодзи без внешних зависимостей. Категории как в мобильном
// приложении. onPick(emoji) вставляет символ; onClose() закрывает по клику вне.
const CATEGORIES = [
  {
    key: "smileys",
    icon: "😀",
    title: "Смайлы и эмоции",
    emojis: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👻 👽 🤖".split(" "),
  },
  {
    key: "gestures",
    icon: "👋",
    title: "Жесты и люди",
    emojis: "👋 🤚 🖐 ✋ 🖖 👌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 👀 👁 👅 👄 💋 🧠 🫀 🦷 👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🙇 🙆 🙅 💁 🙋 🧏 🤦 🤷".split(" "),
  },
  {
    key: "animals",
    icon: "🐶",
    title: "Животные и природа",
    emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🪲 🐢 🐍 🦎 🐙 🦑 🦐 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦛 🐪 🐫 🦒 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🐐 🦌 🐕 🐩 🐈 🌸 🌹 🌻 🌼 🌷 🌱 🌲 🌳 🌴 🌵 🍀 🍁 🍂 🍃".split(" "),
  },
  {
    key: "food",
    icon: "🍔",
    title: "Еда и напитки",
    emojis: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🧀 🥚 🍳 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥙 🧆 🥘 🍝 🍜 🍲 🍣 🍱 🍙 🍚 🍛 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 ☕ 🍵 🥤 🍺 🍻 🥂 🍷 🥃 🍸".split(" "),
  },
  {
    key: "activity",
    icon: "⚽",
    title: "Активности",
    emojis: "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🎱 🏓 🏸 🥅 🏒 🏑 🥍 🏏 ⛳ 🎯 🪀 🪁 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸ 🥌 🎿 ⛷ 🏂 🏋️ 🤸 🤺 ⛹️ 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚴 🚵 🏆 🥇 🥈 🥉 🏅 🎖 🎗 🎫 🎟 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🪕 🎻 🎲 ♟ 🎯 🎳 🎮 🕹".split(" "),
  },
  {
    key: "travel",
    icon: "🚗",
    title: "Путешествия",
    emojis: "🚗 🚕 🚙 🚌 🚎 🏎 🚓 🚑 🚒 🚐 🚚 🚛 🚜 🛴 🚲 🛵 🏍 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩 💺 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥 🛳 ⛴ 🚢 ⚓ 🗽 🗼 🏰 🏯 🎡 🎢 🎠 ⛲ ⛱ 🏖 🏝 🏔 ⛰ 🌋 🗻 🏕 ⛺ 🏠 🏡 🏘 🏚 🏗 🏭 🏢 🏬 🏣 🏤 🏥 🏦".split(" "),
  },
  {
    key: "objects",
    icon: "💡",
    title: "Объекты",
    emojis: "⌚ 📱 💻 ⌨️ 🖥 🖨 🖱 🕹 💽 💾 💿 📀 📷 📸 📹 🎥 📞 ☎️ 📟 📠 📺 📻 🎙 ⏱ ⏰ ⏲ 🕰 🔋 🔌 💡 🔦 🕯 🧯 🛢 💸 💵 💴 💶 💷 💰 💳 💎 ⚖️ 🔧 🔨 ⚒ 🛠 ⛏ 🔩 ⚙️ 🧰 🧲 🔫 💣 🔪 🗡 ⚔️ 🛡 🚬 ⚰️ 🔮 📿 💈 🔭 🔬 🕳 💊 💉 🩸 🌡 🚽 🚿 🛁 🧴 🧷 🧹 🧺 🧻 🧼 🔑 🗝 🚪 🛋 🛏 🖼 🛍 🎁 🎈 🎉 🎊".split(" "),
  },
  {
    key: "symbols",
    icon: "❤️",
    title: "Символы",
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉 ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 ♨️ 🚷 ✅ ❎ ✔️ ➕ ➖ ➗ ✖️ ♾ 💲 💱 ❓ ❔ ❗ ❕ 〰️".split(" "),
  },
  {
    key: "flags",
    icon: "🏁",
    title: "Флаги",
    emojis: "🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏴‍☠️ 🇷🇺 🇺🇸 🇬🇧 🇩🇪 🇫🇷 🇮🇹 🇪🇸 🇵🇹 🇹🇷 🇺🇦 🇰🇿 🇨🇳 🇯🇵 🇰🇷 🇮🇳 🇧🇷 🇨🇦 🇦🇺 🇸🇦 🇦🇪 🇪🇬 🇵🇱 🇳🇱 🇸🇪 🇳🇴 🇫🇮 🇩🇰 🇨🇭 🇦🇹 🇬🇷 🇮🇪 🇲🇽 🇦🇷".split(" "),
  },
];

export default function EmojiPicker({ onPick, onClose }) {
  const [active, setActive] = useState(CATEGORIES[0].key);
  const rootRef = useRef(null);

  // Закрытие по клику вне пикера и по Esc.
  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose?.();
    };
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const cat = CATEGORIES.find((c) => c.key === active) || CATEGORIES[0];

  return (
    <div ref={rootRef} className="emoji-picker">
      <div className="emoji-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={"emoji-tab" + (c.key === active ? " active" : "")}
            title={c.title}
            onClick={() => setActive(c.key)}
            type="button"
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div className="emoji-title">{cat.title}</div>
      <div className="emoji-grid">
        {cat.emojis.map((e, i) => (
          <button
            key={cat.key + i}
            className="emoji-cell"
            type="button"
            onClick={() => onPick?.(e)}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
