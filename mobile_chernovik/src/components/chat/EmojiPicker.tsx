import { useEffect, useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { font, radius, Palette } from '@/theme/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useT, TKey } from '@/i18n';

const RECENTS_KEY = 'emoji.recents';
const COLS = 8;

type Category = { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; emojis: string[] };

// Curated, offline emoji set grouped like Telegram's picker. Rendered as plain
// Unicode text — no native module or font asset required.
const CATEGORIES: Category[] = [
  {
    key: 'smileys', icon: 'happy-outline', label: 'Смайлы и эмоции',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','🫠','😉','😊','😇','🥰','😍',
      '🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢',
      '🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌',
      '😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠',
      '🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹',
      '😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤',
      '😡','😠','🤬','😈','👿','💀','💩','🤡','👹','👺','👻','👽','🤖','😺','😸','😹',
    ],
  },
  {
    key: 'gestures', icon: 'hand-left-outline', label: 'Жесты и люди',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉',
      '👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲',
      '🙏','✍️','💅','🤝','💪','🦾','🦵','🦶','👂','👃','🧠','🫀','👀','👁️','👅','👄',
      '👶','🧒','👦','👧','🧑','👨','👩','🧓','👴','👵','🙇','💁','🙅','🙆','🙋','🧏',
      '🤦','🤷','👮','🕵️','💂','👷','🤴','👸','🦸','🦹','🧙','🧚','🧛','🧜','🧝','🎅',
    ],
  },
  {
    key: 'animals', icon: 'paw-outline', label: 'Животные и природа',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔',
      '🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞',
      '🐜','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬',
      '🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🐘','🦏','🐪','🐫','🦒','🦘','🐄','🐎',
      '🌵','🎄','🌲','🌳','🌴','🌱','🌿','☘️','🍀','🍁','🍂','🍃','🌷','🌹','🌺','🌸',
      '🌼','🌻','🌞','🌝','🌚','🌙','⭐','🌟','✨','⚡','🔥','🌈','☀️','⛅','☁️','💧',
    ],
  },
  {
    key: 'food', icon: 'fast-food-outline', label: 'Еда и напитки',
    emojis: [
      '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥',
      '🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🧄','🧅','🥔','🍠','🥐',
      '🥯','🍞','🥖','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟',
      '🍕','🥪','🌮','🌯','🫔','🥙','🧆','🥘','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤',
      '🍙','🍚','🍘','🍥','🥠','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭',
      '🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','☕','🍵','🧃','🥤','🍺','🍻',
    ],
  },
  {
    key: 'activity', icon: 'football-outline', label: 'Активность',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍',
      '🏏','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿',
      '⛷️','🏂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗',
      '🚴','🚵','🎖️','🏆','🥇','🥈','🥉','🏅','🎗️','🎫','🎟️','🎪','🤹','🎭','🎨','🎬',
      '🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰',
    ],
  },
  {
    key: 'travel', icon: 'car-outline', label: 'Путешествия и места',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🚚','🚛','🚜','🛵','🏍️','🛺',
      '🚲','🛴','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅',
      '🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','🚁','🛸','🚀','🛰️','⛵','🚤',
      '🛥️','🛳️','⛴️','🚢','⚓','🗺️','🗽','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️',
      '🏖️','🏝️','🏜️','🌋','⛰️','🏔️','🗻','🏕️','⛺','🏠','🏡','🏘️','🏢','🏬','🏭','🏗️',
    ],
  },
  {
    key: 'objects', icon: 'bulb-outline', label: 'Объекты',
    emojis: [
      '⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🕹️','💽','💾','💿','📀','📷','📸','📹','🎥',
      '📞','☎️','📟','📠','📺','📻','🎙️','⏱️','⏰','⏳','🔋','🔌','💡','🔦','🕯️','🧯',
      '🛢️','💸','💵','💴','💶','💷','💰','💳','💎','⚖️','🧰','🔧','🔨','⚒️','🛠️','⛏️',
      '🔩','⚙️','🧱','⛓️','🧲','🔫','💣','🧨','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🔮','📿',
      '💊','💉','🩺','🌡️','🧬','🔬','🔭','📡','🧴','🧷','🧹','🧺','🧻','🚿','🛁','🔑',
    ],
  },
  {
    key: 'symbols', icon: 'heart-outline', label: 'Символы',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
      '💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈',
      '♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','✴️','🆚','💮',
      '🉐','㊙️','㊗️','🈵','🈲','🅰️','🅱️','🆎','🅾️','💯','🔅','🔆','✅','❌','❎','⭕',
      '🚫','💢','♨️','🔱','⚜️','🔰','♻️','✳️','❇️','❗','❓','❕','❔','‼️','⁉️','〽️',
    ],
  },
  {
    key: 'flags', icon: 'flag-outline', label: 'Флаги',
    emojis: [
      '🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇺🇿','🇷🇺','🇺🇸','🇬🇧','🇩🇪','🇫🇷','🇪🇸','🇮🇹',
      '🇨🇳','🇯🇵','🇰🇷','🇮🇳','🇹🇷','🇧🇷','🇨🇦','🇦🇺','🇺🇦','🇰🇿','🇰🇬','🇹🇯','🇹🇲','🇦🇿','🇦🇪','🇸🇦',
    ],
  },
];

export function EmojiPicker({
  onPick,
  onBackspace,
  height = 300,
}: {
  onPick: (emoji: string) => void;
  onBackspace: () => void;
  height?: number;
}) {
  const { c } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [active, setActive] = useState('smileys');
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(RECENTS_KEY)
      .then((raw) => { if (raw) setRecents(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  const pick = (e: string) => {
    onPick(e);
    setRecents((prev) => {
      const next = [e, ...prev.filter((x) => x !== e)].slice(0, 24);
      AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const tabs: { key: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    ...(recents.length ? [{ key: 'recent', icon: 'time-outline' as const }] : []),
    ...CATEGORIES.map((c) => ({ key: c.key, icon: c.icon })),
  ];

  const current =
    active === 'recent'
      ? { emojis: recents }
      : CATEGORIES.find((c) => c.key === active) || CATEGORIES[0];
  const sectionLabel = t(`emoji.${active}` as TKey);

  return (
    <View style={[styles.wrap, { height }]}>
      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <Pressable key={tab.key} onPress={() => setActive(tab.key)} style={styles.tab} hitSlop={4}>
            <Ionicons name={tab.icon} size={22} color={active === tab.key ? c.accent : c.textFaint} />
            {active === tab.key ? <View style={styles.tabDot} /> : null}
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onBackspace} style={styles.tab} hitSlop={4}>
          <Ionicons name="backspace-outline" size={22} color={c.textFaint} />
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>{sectionLabel}</Text>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {current.emojis.map((e, i) => (
          <Pressable
            key={`${e}_${i}`}
            onPress={() => pick(e)}
            style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
          >
            <Text style={styles.emoji}>{e}</Text>
          </Pressable>
        ))}
        {current.emojis.length === 0 ? (
          <Text style={styles.empty}>{t('emoji.emptyRecent')}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  wrap: {
    backgroundColor: c.bg2,
    borderTopWidth: 1, borderTopColor: c.stroke,
  },
  tabs: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingTop: 6,
    borderBottomWidth: 1, borderBottomColor: c.stroke,
  },
  tab: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center' },
  tabDot: { position: 'absolute', bottom: 2, width: 5, height: 5, borderRadius: 3, backgroundColor: c.accent },
  sectionLabel: {
    color: c.textFaint, fontFamily: font.bodySemi, fontSize: 12,
    letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, paddingBottom: 12 },
  cell: { width: `${100 / COLS}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  cellPressed: { backgroundColor: c.glass2 },
  emoji: { fontSize: 28 },
  empty: { color: c.textFaint, fontFamily: font.body, fontSize: 13, padding: 18, textAlign: 'center', width: '100%' },
});
