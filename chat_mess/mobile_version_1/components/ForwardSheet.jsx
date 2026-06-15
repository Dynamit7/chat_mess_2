import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Image,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  FadeIn,
  FadeOut,
  SlideInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { BASE_URL } from '../src/config';
import axios from 'axios';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TAB_WIDTH = (SCREEN_WIDTH - 48) / 3;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

const TABS = [
  { key: 'chats', label: 'Чаты' },
  { key: 'groups', label: 'Группы' },
  { key: 'channels', label: 'Каналы' },
];

const SPRING_CONFIG = { damping: 20, stiffness: 150, mass: 0.8 };
const BOUNCY_SPRING = { damping: 10, stiffness: 180, mass: 0.6 };

// Determine theme colors from isDarkMode prop
const getTheme = (isDarkMode) => {
  if (isDarkMode) {
    return {
      bg: '#0B0F19',
      bgElevated: '#0B0F19',
      surface: '#1A2233',
      surfaceTertiary: '#333333',
      textPrimary: '#FAFAFA',
      textSecondary: '#A1A1AA',
      textTertiary: '#71717A',
      borderLight: '#27272A',
      borderMedium: '#3F3F46',
    };
  }
  return {
    bg: '#FFFFFF',
    bgElevated: '#FFFFFF',
    surface: '#F8FAFC',
    surfaceTertiary: '#F5F7FA',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    borderLight: '#F5F7FA',
    borderMedium: '#CBD5E1',
  };
};

// Animated checkmark
const AnimatedCheck = ({ selected }) => {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = selected
      ? withSpring(1, BOUNCY_SPRING)
      : withTiming(0, { duration: 150 });
  }, [selected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  return (
    <Animated.View style={[styles.checkCircle, animatedStyle]}>
      <LinearGradient
        colors={['#7C5CFF', '#5B3FE0']}
        style={styles.checkGradient}
      >
        <Ionicons name="checkmark" size={14} color="#fff" />
      </LinearGradient>
    </Animated.View>
  );
};

// Selected chip
const SelectedChip = ({ item, onRemove }) => (
  <Animated.View
    entering={FadeIn.duration(200).springify()}
    exiting={FadeOut.duration(150)}
    style={styles.chip}
  >
    <Text style={styles.chipText} numberOfLines={1}>
      {item.name}
    </Text>
    <TouchableOpacity onPress={() => onRemove(item)} hitSlop={8}>
      <Ionicons name="close-circle" size={16} color="#7C5CFF" />
    </TouchableOpacity>
  </Animated.View>
);

// Destination list item
const DestinationItem = React.memo(({ item, index, selected, onToggle, theme }) => {
  const animatedScale = useSharedValue(1);

  const handlePress = () => {
    animatedScale.value = withSequence(
      withTiming(0.96, { duration: 80 }),
      withSpring(1, SPRING_CONFIG)
    );
    onToggle(item);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animatedScale.value }],
  }));

  const firstLetter = (item.name || '?')[0].toUpperCase();

  return (
    <Animated.View
      entering={FadeIn.delay(index * 30).duration(200)}
      style={animatedStyle}
    >
      <TouchableOpacity
        style={[styles.destItem, { borderBottomColor: theme.borderLight }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <LinearGradient
            colors={['#7C5CFF', '#9070FF']}
            style={styles.avatarGradient}
          >
            <Text style={styles.avatarLetter}>{firstLetter}</Text>
          </LinearGradient>
          {item.picture ? (
            <Image source={{ uri: item.picture }} style={styles.avatarImage} />
          ) : null}
        </View>

        {/* Info */}
        <View style={styles.destInfo}>
          <Text style={[styles.destName, { color: theme.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.subtitle ? (
            <Text style={[styles.destSubtitle, { color: theme.textTertiary }]} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>

        {/* Checkmark */}
        <AnimatedCheck selected={selected} />
      </TouchableOpacity>
    </Animated.View>
  );
});

const ForwardSheet = ({ visible, onClose, messageToForward, currentUserId, isDarkMode }) => {
  const theme = getTheme(isDarkMode);

  const [activeTab, setActiveTab] = useState('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Data
  const [chats, setChats] = useState([]);
  const [groups, setGroups] = useState([]);
  const [channels, setChannels] = useState([]);

  // Tab indicator animation
  const tabIndicatorX = useSharedValue(0);
  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabIndicatorX.value }],
  }));

  // Send button animation
  const sendButtonScale = useSharedValue(0);
  const sendButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
    opacity: sendButtonScale.value,
  }));

  useEffect(() => {
    sendButtonScale.value = selected.length > 0
      ? withSpring(1, BOUNCY_SPRING)
      : withTiming(0, { duration: 150 });
  }, [selected.length]);

  // Load data when sheet opens
  useEffect(() => {
    if (visible) {
      loadData();
    } else {
      setSelected([]);
      setSearchQuery('');
      setActiveTab('chats');
      tabIndicatorX.value = 0;
    }
  }, [visible]);

  const loadData = async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const [chatsRes, groupsRes, channelsRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/messages/getChats?userId=${currentUserId}`),
        axios.get(`${BASE_URL}/api/groups?search=&userId=${currentUserId}`),
        axios.get(`${BASE_URL}/api/channels?search=&userId=${currentUserId}`),
      ]);

      setChats(
        (chatsRes.data || []).map((c) => ({
          id: c.partnerId,
          name: c.username || 'Unknown',
          picture: c.picture || null,
          subtitle: c.lastMessage || '',
          type: 'direct',
        }))
      );
      setGroups(
        (groupsRes.data || []).map((g) => ({
          id: g.id,
          name: g.name || 'Group',
          picture: g.avatar || null,
          subtitle: `${g.memberCount || 0} участников`,
          type: 'group',
        }))
      );
      setChannels(
        (channelsRes.data || []).filter((ch) => Number(ch.ownerId) === Number(currentUserId)).map((ch) => ({
          id: ch.id,
          name: ch.name || 'Channel',
          picture: ch.avatar || null,
          subtitle: `${ch.memberCount || 0} подписчиков`,
          type: 'channel',
        }))
      );
    } catch (err) {
      console.error('Error loading forward destinations:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentData = useMemo(() => {
    let data = [];
    if (activeTab === 'chats') data = chats;
    else if (activeTab === 'groups') data = groups;
    else data = channels;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter((item) => item.name.toLowerCase().includes(q));
    }
    return data;
  }, [activeTab, chats, groups, channels, searchQuery]);

  const handleTabPress = (tab, index) => {
    setActiveTab(tab.key);
    tabIndicatorX.value = withSpring(index * TAB_WIDTH, SPRING_CONFIG);
  };

  const handleToggle = useCallback((item) => {
    setSelected((prev) => {
      const key = `${item.type}_${item.id}`;
      const exists = prev.find((s) => `${s.type}_${s.id}` === key);
      if (exists) {
        return prev.filter((s) => `${s.type}_${s.id}` !== key);
      }
      return [...prev, item];
    });
  }, []);

  const handleRemoveChip = useCallback((item) => {
    setSelected((prev) =>
      prev.filter((s) => `${s.type}_${s.id}` !== `${item.type}_${item.id}`)
    );
  }, []);

  const handleSend = async () => {
    if (!messageToForward || selected.length === 0 || sending) return;

    setSending(true);
    try {
      const destinations = selected.map((s) => ({
        type: s.type,
        id: s.id,
      }));

      await axios.post(`${BASE_URL}/api/messages/forward`, {
        userId: currentUserId,
        sourceMessage: messageToForward,
        destinations,
      });

      // Success pulse animation
      sendButtonScale.value = withSequence(
        withTiming(1.2, { duration: 100 }),
        withSpring(0, SPRING_CONFIG)
      );

      setTimeout(() => {
        onClose?.();
      }, 300);
    } catch (err) {
      console.error('Error forwarding message:', err);
    } finally {
      setSending(false);
    }
  };

  const isSelected = useCallback(
    (item) => !!selected.find((s) => `${s.type}_${s.id}` === `${item.type}_${item.id}`),
    [selected]
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <DestinationItem
        item={item}
        index={index}
        selected={isSelected(item)}
        onToggle={handleToggle}
        theme={theme}
      />
    ),
    [isSelected, handleToggle, theme]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* Sheet */}
        <Animated.View
          entering={SlideInDown.duration(350).springify().damping(18)}
          style={[styles.sheet, { backgroundColor: theme.bgElevated }]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: theme.textTertiary }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              Переслать
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <View style={[styles.closeBtn, { backgroundColor: theme.surfaceTertiary }]}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[styles.searchContainer, { backgroundColor: theme.surfaceTertiary, borderColor: theme.borderLight }]}>
            <Ionicons name="search" size={18} color={theme.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder="Поиск..."
              placeholderTextColor={theme.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Tabs */}
          <View style={[styles.tabBar, { borderBottomColor: theme.borderLight }]}>
            {TABS.map((tab, index) => (
              <TouchableOpacity
                key={tab.key}
                style={styles.tab}
                onPress={() => handleTabPress(tab, index)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: activeTab === tab.key ? '#7C5CFF' : theme.textTertiary,
                      fontWeight: activeTab === tab.key ? '600' : '400',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
            <Animated.View style={[styles.tabIndicator, tabIndicatorStyle]} />
          </View>

          {/* List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#7C5CFF" />
            </View>
          ) : (
            <FlatList
              data={currentData}
              renderItem={renderItem}
              keyExtractor={(item) => `${item.type}_${item.id}`}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons
                    name="account-search"
                    size={48}
                    color={theme.textTertiary}
                  />
                  <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
                    {searchQuery ? 'Ничего не найдено' : 'Нет доступных чатов'}
                  </Text>
                </View>
              }
            />
          )}

          {/* Bottom bar: selected chips + send button */}
          {selected.length > 0 && (
            <Animated.View
              entering={SlideInDown.duration(200).springify()}
              style={[styles.bottomBar, { backgroundColor: theme.bgElevated, borderTopColor: theme.borderLight }]}
            >
              <FlatList
                data={selected}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => `chip_${item.type}_${item.id}`}
                renderItem={({ item }) => (
                  <SelectedChip item={item} onRemove={handleRemoveChip} />
                )}
                contentContainerStyle={styles.chipsContainer}
                style={styles.chipsList}
              />
              <Animated.View style={sendButtonStyle}>
                <TouchableOpacity
                  onPress={handleSend}
                  activeOpacity={0.8}
                  disabled={sending}
                >
                  <LinearGradient
                    colors={['#7C5CFF', '#5B3FE0']}
                    style={styles.sendButton}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="send" size={20} color="#fff" />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 40,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    paddingVertical: 0,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderBottomWidth: 1,
    position: 'relative',
  },
  tab: {
    width: TAB_WIDTH,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 14,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    width: TAB_WIDTH,
    height: 2,
    backgroundColor: '#7C5CFF',
    borderRadius: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
  destItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatarGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  destInfo: {
    flex: 1,
    marginLeft: 12,
  },
  destName: {
    fontSize: 16,
    fontWeight: '500',
  },
  destSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  checkGradient: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  chipsList: {
    flex: 1,
  },
  chipsContainer: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 92, 255, 0.1)',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  chipText: {
    fontSize: 13,
    color: '#7C5CFF',
    fontWeight: '500',
    maxWidth: 80,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ForwardSheet;
