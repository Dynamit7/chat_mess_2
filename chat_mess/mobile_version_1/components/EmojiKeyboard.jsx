import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../ThemeContext';

const NUM_COLUMNS = 8;

const CATEGORIES = [
  {
    key: 'smileys',
    icon: '😊',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃',
      '😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
      '🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢',
      '🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏',
      '😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷',
      '🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯',
      '🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁',
      '😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰',
      '😥','😢','😭','😱','😖','😣','😞','😓','😩','😫',
      '🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩',
      '🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹',
      '😻','😼','😽','🙀','😿','😾',
    ],
  },
  {
    key: 'gestures',
    icon: '👋',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌',
      '🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉',
      '👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛',
      '🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅',
      '🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠',
      '🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦','👶',
      '🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴',
      '👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦',
      '🤷','👮','🕵️','💂','🥷','👷','🫅','🤴','👸','👳',
      '👲','🧕','🤵','👰','🤰','🫃','🫄','🤱',
    ],
  },
  {
    key: 'animals',
    icon: '🐶',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨',
      '🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊',
      '🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉',
      '🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌',
      '🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🦂','🐢',
      '🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🪸',
      '🐡','🐠','🐟','🐬','🐳','🐋','🦈','🦭','🐊','🐅',
      '🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒',
    ],
  },
  {
    key: 'food',
    icon: '🍔',
    emojis: [
      '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐',
      '🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑',
      '🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅',
      '🥔','🍠','🫘','🥐','🥖','🍞','🥨','🥯','🧀','🥚',
      '🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭',
      '🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔',
      '🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱',
      '🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢',
      '🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭',
      '🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼',
      '🫖','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂',
      '🍷','🥃','🍸','🍹','🧉','🍾','🫗',
    ],
  },
  {
    key: 'activities',
    icon: '⚽',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱',
      '🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳',
      '🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷',
      '⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','🤺',
      '⛹️','🧘','🏄','🏊','🤽','🚣','🧗','🚴','🚵','🏇',
      '🎯','🎳','🎮','🕹️','🎰','🧩','🎲','♟️','🎭','🎨',
      '🎼','🎵','🎶','🎹','🥁','🪘','🎷','🎺','🪗','🎸',
      '🎻','🎬','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🎪',
    ],
  },
  {
    key: 'travel',
    icon: '🚗',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐',
      '🛻','🚚','🚛','🚜','🛵','🏍️','🛺','🚲','🛴','🚨',
      '🚔','🚍','🚘','🚖','🛞','🚡','🚠','🚟','🚃','🚋',
      '🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉',
      '✈️','🛫','🛬','🛩️','💺','🛰️','🚀','🛸','🚁','🛶',
      '⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','🪝','⛽','🚧',
      '🚦','🚥','🗺️','🗿','🗽','🗼','🏰','🏯','🏟️','🎡',
      '🎢','🎠','⛲','⛱️','🏖️','🏝️','🏜️','🌋','⛰️','🏔️',
      '🗻','🏕️','⛺','🛖','🏠','🏡','🏘️','🏚️','🏗️','🏢',
      '🏬','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒',
    ],
  },
  {
    key: 'objects',
    icon: '💡',
    emojis: [
      '⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💾',
      '💿','📀','📷','📸','📹','🎥','📽️','🎞️','📞','☎️',
      '📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️',
      '⏰','🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️',
      '🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳',
      '💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️',
      '🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨',
      '🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺',
      '🔮','📿','🧿','🪬','💈','⚗️','🔭','🔬','🕳️','🩹',
      '🩺','🩻','🩼','💊','💉','🩸','🧬','🦠','🧫','🧪',
    ],
  },
  {
    key: 'symbols',
    icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
      '❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝',
      '💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️',
      '☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎',
      '♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️',
      '📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮',
      '🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎',
      '🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯',
      '💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗',
      '❓','❕','❔','‼️','⁉️','✅','♻️','🔰','⚜️','🔱',
    ],
  },
  {
    key: 'flags',
    icon: '🏳️',
    emojis: [
      '🏳️','🏴','🏁','🚩','🏳️‍🌈','🏳️‍⚧️','🇺🇸','🇬🇧','🇫🇷','🇩🇪',
      '🇮🇹','🇪🇸','🇵🇹','🇷🇺','🇺🇦','🇵🇱','🇳🇱','🇧🇪','🇨🇭','🇦🇹',
      '🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇮🇪','🇮🇸','🇬🇷','🇹🇷','🇨🇳','🇯🇵',
      '🇰🇷','🇮🇳','🇮🇩','🇹🇭','🇻🇳','🇵🇭','🇲🇾','🇸🇬','🇦🇺','🇳🇿',
      '🇨🇦','🇲🇽','🇧🇷','🇦🇷','🇨🇱','🇨🇴','🇵🇪','🇪🇬','🇿🇦','🇳🇬',
      '🇰🇪','🇲🇦','🇸🇦','🇦🇪','🇮🇱','🇶🇦','🇰🇼','🇺🇿','🇰🇿','🇬🇪',
    ],
  },
];

const CATEGORY_NAMES = {
  smileys: 'Смайлы и эмоции',
  gestures: 'Жесты и люди',
  animals: 'Животные и природа',
  food: 'Еда и напитки',
  activities: 'Активности',
  travel: 'Путешествия',
  objects: 'Предметы',
  symbols: 'Символы',
  flags: 'Флаги',
};

const TAB_BAR_HEIGHT = 38;
const CATEGORY_TITLE_HEIGHT = 30;

const EmojiKeyboard = ({ onEmojiSelect, onClose, height = 300 }) => {
  const { isDarkMode } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [activeCategory, setActiveCategory] = useState(0);

  const emojiCellHeight = Math.floor((screenWidth - 32) / NUM_COLUMNS);
  const gridHeight = height - TAB_BAR_HEIGHT - CATEGORY_TITLE_HEIGHT - 10;

  const colors = {
    bg: isDarkMode ? '#121826' : '#FFFFFF',
    tabBg: isDarkMode ? '#0B0F19' : '#F3F0FF',
    tabActive: isDarkMode ? '#2d2650' : '#EDE9FE',
    tabIndicator: '#7C5CFF',
    border: isDarkMode ? 'rgba(255,255,255,0.08)' : '#EDE9FE',
    categoryTitle: isDarkMode ? 'rgba(255,255,255,0.35)' : '#AD94FF',
  };

  const currentCategory = CATEGORIES[activeCategory];

  const handleEmojiPress = useCallback((emoji) => {
    onEmojiSelect(emoji);
  }, [onEmojiSelect]);

  const renderEmojiItem = useCallback(({ item }) => (
    <TouchableOpacity
      onPress={() => handleEmojiPress(item)}
      style={[ekStyles.emojiCell, { height: emojiCellHeight }]}
      activeOpacity={0.5}
    >
      <Text style={ekStyles.emojiText}>{item}</Text>
    </TouchableOpacity>
  ), [handleEmojiPress, emojiCellHeight]);

  return (
    <View style={[ekStyles.container, { backgroundColor: colors.bg, borderColor: colors.border, height }]}>
      {/* Category Tabs */}
      <View style={[ekStyles.tabBar, { backgroundColor: colors.tabBg, borderBottomColor: colors.border, height: TAB_BAR_HEIGHT }]}>
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={ekStyles.closeButton}
            activeOpacity={0.7}
          >
            <Text style={[ekStyles.closeIcon, { color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#999' }]}>✕</Text>
          </TouchableOpacity>
        )}
        {CATEGORIES.map((cat, index) => {
          const isActive = activeCategory === index;
          return (
            <TouchableOpacity
              key={cat.key}
              onPress={() => setActiveCategory(index)}
              style={[ekStyles.tab, isActive && [ekStyles.tabActive, { backgroundColor: colors.tabActive }]]}
              activeOpacity={0.7}
            >
              <Text style={[ekStyles.tabIcon, isActive && ekStyles.tabIconActive]}>
                {cat.icon}
              </Text>
              {isActive && (
                <View style={[ekStyles.tabIndicator, { backgroundColor: colors.tabIndicator }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Category Title */}
      <Text style={[ekStyles.categoryTitle, { color: colors.categoryTitle, height: CATEGORY_TITLE_HEIGHT }]}>
        {CATEGORY_NAMES[currentCategory.key]}
      </Text>

      {/* Emoji Grid — scrollable vertically */}
      <FlatList
        key={currentCategory.key}
        data={currentCategory.emojis}
        renderItem={renderEmojiItem}
        keyExtractor={(item, i) => `${currentCategory.key}-${i}`}
        numColumns={NUM_COLUMNS}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={ekStyles.gridContent}
        style={[ekStyles.grid, { height: gridHeight }]}
      />
    </View>
  );
};

const ekStyles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  closeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginRight: 2,
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderRadius: 10,
    position: 'relative',
  },
  tabActive: {
    borderRadius: 10,
  },
  tabIcon: {
    fontSize: 17,
    opacity: 0.45,
  },
  tabIconActive: {
    opacity: 1,
    fontSize: 19,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 14,
    height: 2.5,
    borderRadius: 1.5,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  grid: {
  },
  gridContent: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  emojiCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
});

export default React.memo(EmojiKeyboard);
