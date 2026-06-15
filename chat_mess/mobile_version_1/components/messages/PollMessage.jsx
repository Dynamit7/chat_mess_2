/**
 * PollMessage Component
 * Display and interact with polls in chat
 * Super-App Messenger 2026
 */

import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  Layout,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_URL } from '../../src/config';

// Small avatar circle for voter stacks
const VoterAvatar = memo(({ voter, index }) => {
  const [broken, setBroken] = useState(false);
  const initials = voter.username ? voter.username[0].toUpperCase() : '?';
  const showImg = voter.avatar && !broken;
  return (
    <View style={[voterStyles.av, { marginLeft: index === 0 ? 0 : -6 }]}>
      {showImg ? (
        <Image
          source={{ uri: voter.avatar }}
          style={voterStyles.avImg}
          onError={() => setBroken(true)}
        />
      ) : (
        <Text style={voterStyles.avInitial}>{initials}</Text>
      )}
    </View>
  );
});

const voterStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  av: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,45,85,0.5)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avImg: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  avInitial: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  more: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginLeft: 6,
  },
});

const PollOption = memo(({
  option,
  totalVotes,
  isSelected,
  isCorrect,
  showResults,
  onSelect,
  disabled,
  isQuiz,
  hasVoted,
  isAnonymous,
}) => {
  const scale = useSharedValue(1);
  const progressWidth = useSharedValue(0);

  const percentage = totalVotes > 0 ? Math.round((option.votesCount / totalVotes) * 100) : 0;
  const voters = option.voters || [];

  React.useEffect(() => {
    if (showResults) {
      progressWidth.value = withTiming(percentage, { duration: 500 });
    }
  }, [showResults, percentage]);

  const handlePress = () => {
    if (disabled || showResults) return;
    scale.value = withSpring(0.98, {}, () => {
      scale.value = withSpring(1);
    });
    onSelect();
  };

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const getBackgroundColor = () => {
    if (!showResults) {
      return isSelected ? 'rgba(255,45,85,0.2)' : 'rgba(255,255,255,0.1)';
    }
    if (isQuiz && hasVoted) {
      if (isCorrect) return 'rgba(52,199,89,0.2)';
      if (isSelected && !isCorrect) return 'rgba(255,59,48,0.2)';
    }
    return 'rgba(255,255,255,0.05)';
  };

  const getBorderColor = () => {
    if (!showResults) {
      return isSelected ? '#FF2D55' : 'transparent';
    }
    if (isQuiz && hasVoted) {
      if (isCorrect) return '#34C759';
      if (isSelected && !isCorrect) return '#FF3B30';
    }
    return 'transparent';
  };

  return (
    <Animated.View style={[scaleStyle, styles.optionWrapper]} layout={Layout.springify()}>
      <TouchableOpacity
        style={[
          styles.option,
          {
            backgroundColor: getBackgroundColor(),
            borderColor: getBorderColor(),
            borderWidth: isSelected || (isQuiz && isCorrect && hasVoted) ? 1 : 0,
          },
        ]}
        onPress={handlePress}
        disabled={disabled || showResults}
        activeOpacity={0.7}
      >
        {/* Progress bar */}
        {showResults && (
          <Animated.View style={[styles.progressBar, progressStyle]}>
            <LinearGradient
              colors={
                isQuiz && isCorrect
                  ? ['rgba(52,199,89,0.3)', 'rgba(52,199,89,0.1)']
                  : ['rgba(255,45,85,0.3)', 'rgba(255,45,85,0.1)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

        {/* Content */}
        <View style={styles.optionContent}>
          {!showResults && (
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
          )}

          <Text style={styles.optionText} numberOfLines={2}>
            {option.text}
          </Text>

          {showResults && (
            <View style={styles.optionResult}>
              {isQuiz && hasVoted && isCorrect && (
                <Ionicons name="checkmark-circle" size={18} color="#34C759" />
              )}
              {isQuiz && hasVoted && isSelected && !isCorrect && (
                <Ionicons name="close-circle" size={18} color="#FF3B30" />
              )}
              <Text style={styles.percentageText}>{percentage}%</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Voter avatars — only when results visible and poll is not anonymous */}
      {showResults && !isAnonymous && voters.length > 0 && (
        <View style={voterStyles.row}>
          {voters.slice(0, 5).map((v, i) => (
            <VoterAvatar key={v.id} voter={v} index={i} />
          ))}
          {voters.length > 5 && (
            <Text style={voterStyles.more}>+{voters.length - 5}</Text>
          )}
        </View>
      )}
    </Animated.View>
  );
});

const PollMessage = ({ poll: initialPoll, pollId, onVote }) => {
  const [poll, setPoll] = useState(initialPoll || null);
  const [selectedOptions, setSelectedOptions] = useState(initialPoll?.userVotedOptions || []);
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(initialPoll?.hasVoted || false);
  const [showResults, setShowResults] = useState(initialPoll?.hasVoted || initialPoll?.isClosed || false);
  const [showVoters, setShowVoters] = useState(false);

  const loadPoll = useCallback(async () => {
    const id = poll?.id || pollId;
    if (!id) return;
    try {
      const token = await AsyncStorage.getItem('token');
      const userId = await AsyncStorage.getItem('userId');
      const res = await fetch(`${BASE_URL}/api/polls/${id}?userId=${userId || ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok && data.poll) {
        setPoll(data.poll);
        setSelectedOptions(data.poll.userVotedOptions || []);
        setHasVoted(!!data.poll.hasVoted);
        setShowResults(!!data.poll.hasVoted || !!data.poll.isClosed);
      }
    } catch (e) {
      // silent
    }
  }, [poll?.id, pollId]);

  // Self-fetch when only a pollId is given (e.g. a forwarded poll in a DM).
  React.useEffect(() => {
    if (initialPoll || !pollId) return;
    loadPoll();
  }, [pollId, initialPoll]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOptionSelect = useCallback((optionId) => {
    if (poll?.allowMultipleAnswers) {
      setSelectedOptions(prev =>
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
    }
  }, [poll?.allowMultipleAnswers]);

  const handleVote = useCallback(async () => {
    if (selectedOptions.length === 0 || isVoting) return;

    setIsVoting(true);

    try {
      const token = await AsyncStorage.getItem('token');
      const userId = await AsyncStorage.getItem('userId');
      const response = await fetch(`${BASE_URL}/api/polls/${poll?.id}/vote`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ optionIds: selectedOptions, userId: userId ? Number(userId) : undefined }),
      });

      const data = await response.json();

      if (response.ok) {
        onVote?.(data.poll);
        // Reload full poll to get voters list
        await loadPoll();
      }
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setIsVoting(false);
    }
  }, [poll?.id, selectedOptions, isVoting, onVote, loadPoll]);

  const handleRetractVote = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userId = await AsyncStorage.getItem('userId');
      await fetch(`${BASE_URL}/api/polls/${poll?.id}/retract`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: userId ? Number(userId) : undefined }),
      });

      setSelectedOptions([]);
      setHasVoted(false);
      setShowResults(false);
    } catch (error) {
      console.error('Error retracting vote:', error);
    }
  }, [poll?.id]);

  if (!poll) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', minHeight: 80 }]}>
        <ActivityIndicator color="#7C5CFF" />
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      {/* Poll Type Badge */}
      {poll.isQuiz && (
        <View style={styles.quizBadge}>
          <Ionicons name="school" size={12} color="#fff" />
          <Text style={styles.quizBadgeText}>Quiz</Text>
        </View>
      )}

      {/* Question */}
      <Text style={styles.question}>{poll.question}</Text>

      {/* Options */}
      <View style={styles.options}>
        {poll.options?.map((option, index) => (
          <PollOption
            key={option.id}
            option={option}
            totalVotes={poll.totalVotes || 0}
            isSelected={selectedOptions.includes(option.id)}
            isCorrect={poll.isQuiz && index === poll.correctOptionIndex}
            showResults={showResults}
            onSelect={() => handleOptionSelect(option.id)}
            disabled={poll.isClosed}
            isQuiz={poll.isQuiz}
            hasVoted={hasVoted}
            isAnonymous={poll.isAnonymous}
          />
        ))}
      </View>

      {/* Quiz Explanation */}
      {poll.isQuiz && hasVoted && poll.explanation && (
        <View style={styles.explanationContainer}>
          <Ionicons name="bulb" size={16} color="#FFCC00" />
          <Text style={styles.explanationText}>{poll.explanation}</Text>
        </View>
      )}

      {/* Vote Button or Stats */}
      <View style={styles.footer}>
        {!hasVoted && !poll.isClosed ? (
          <TouchableOpacity
            style={[
              styles.voteButton,
              selectedOptions.length === 0 && styles.voteButtonDisabled,
            ]}
            onPress={handleVote}
            disabled={selectedOptions.length === 0 || isVoting}
          >
            {isVoting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.voteButtonText}>Vote</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.stats}
            onPress={() => setShowVoters(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.statsText, styles.statsTextTappable]}>
              {poll.totalVotes || 0} {poll.totalVotes === 1 ? 'vote' : 'votes'}
            </Text>
            {poll.isAnonymous && (
              <View style={styles.anonymousBadge}>
                <Ionicons name="eye-off" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={styles.anonymousText}>Anonymous</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Actions */}
        {hasVoted && !poll.isClosed && (
          <TouchableOpacity style={styles.retractButton} onPress={handleRetractVote}>
            <Text style={styles.retractText}>Retract vote</Text>
          </TouchableOpacity>
        )}

        {poll.isClosed && (
          <View style={styles.closedBadge}>
            <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.5)" />
            <Text style={styles.closedText}>Poll closed</Text>
          </View>
        )}
      </View>
      {showVoters && (
        <VotersModal
          pollId={poll.id}
          isAnonymous={poll.isAnonymous}
          onClose={() => setShowVoters(false)}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    maxWidth: 320,
  },
  quizBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5856D6',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    marginBottom: 12,
  },
  quizBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  question: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    lineHeight: 22,
  },
  options: {
    gap: 8,
  },
  optionWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  option: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#FF2D55',
    borderColor: '#FF2D55',
  },
  optionText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  optionResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  percentageText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  explanationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,204,0,0.1)',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  explanationText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  voteButton: {
    backgroundColor: '#FF2D55',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  voteButtonDisabled: {
    opacity: 0.5,
  },
  voteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statsText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  statsTextTappable: {
    textDecorationLine: 'underline',
  },
  anonymousBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  anonymousText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  retractButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  retractText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  closedText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
});

// Modal showing who voted, grouped by option
const VotersModal = memo(({ pollId, isAnonymous, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const res = await fetch(`${BASE_URL}/api/polls/${pollId}/voters`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (res.ok) setData(json.voters || []);
      } catch (_) {}
      setLoading(false);
    })();
  }, [pollId]);

  // Group voters by option
  const byOption = React.useMemo(() => {
    if (!data) return {};
    return data.reduce((acc, v) => {
      const key = v.option?.id;
      if (!acc[key]) acc[key] = { option: v.option, users: [] };
      acc[key].users.push(v.user);
      return acc;
    }, {});
  }, [data]);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity style={votersModalStyles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={votersModalStyles.sheet}>
        {/* Handle */}
        <View style={votersModalStyles.handle} />

        <Text style={votersModalStyles.title}>Проголосовали</Text>

        {loading ? (
          <ActivityIndicator color="#7C5CFF" style={{ marginTop: 24 }} />
        ) : isAnonymous ? (
          <View style={votersModalStyles.anon}>
            <Ionicons name="eye-off" size={32} color="rgba(255,255,255,0.3)" />
            <Text style={votersModalStyles.anonText}>Анонимный опрос</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
            {Object.values(byOption).map(({ option, users }) => (
              <View key={option?.id} style={votersModalStyles.optionGroup}>
                <Text style={votersModalStyles.optionLabel} numberOfLines={1}>
                  {option?.text}
                </Text>
                {users.map((u) => (
                  <View key={u.id} style={votersModalStyles.userRow}>
                    <View style={votersModalStyles.userAv}>
                      {u.avatar ? (
                        <Image source={{ uri: u.avatar }} style={votersModalStyles.userAvImg} />
                      ) : (
                        <Text style={votersModalStyles.userAvInitial}>
                          {u.username?.[0]?.toUpperCase() || '?'}
                        </Text>
                      )}
                    </View>
                    <Text style={votersModalStyles.userName}>{u.username}</Text>
                  </View>
                ))}
              </View>
            ))}
            {data.length === 0 && (
              <Text style={votersModalStyles.empty}>Пока никто не голосовал</Text>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
});

const votersModalStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1C1C2E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  optionGroup: {
    marginBottom: 16,
  },
  optionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  userAv: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,45,85,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  userAvImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  userAvInitial: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  userName: {
    color: '#fff',
    fontSize: 15,
  },
  anon: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  anonText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
  empty: {
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14,
  },
});

PollOption.displayName = 'PollOption';
VoterAvatar.displayName = 'VoterAvatar';
VotersModal.displayName = 'VotersModal';

export default PollMessage;
