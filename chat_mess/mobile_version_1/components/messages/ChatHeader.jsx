// components/chat/ChatHeader.jsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Platform, Modal, TextInput } from 'react-native';
import Icon from '@expo/vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../ThemeContext';
import socket from '../../src/socket';
import CallProgressModal from '../../screens/CallProgressModal';
import { BASE_URL, fixFileUrl } from "../../src/config";

export default function ChatHeader({
  username: initialUsername,
  bio,
  picture: initialPicture,
  onlineStatus,
  currentUserId,
  partnerId,
  selectedMessages,
  setSelectedMessages,
  setMultiSelect,
  onDeleteMessages,
  onEditMessage,
  onForwardMessages,
  messages,
  typingUsers = [],
  onSearchPress,
}) {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();

  const [isModalVisible, setModalVisible] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [username, setUsername] = useState(initialUsername);
  const [picture, setPicture] = useState(initialPicture);
  const [isCalling, setIsCalling] = useState(false);

  useEffect(() => {
    setUsername(initialUsername);
    setPicture(initialPicture);
  }, [initialUsername, initialPicture]);

  useEffect(() => {
    const handleProfileUpdated = (data) => {
      if (data.userId === partnerId) {
        setUsername(data.username);
        setPicture(data.avatar);
      }
    };

    socket.on('profileUpdated', handleProfileUpdated);
    return () => {
      socket.off('profileUpdated', handleProfileUpdated);
    };
  }, [partnerId]);

  useEffect(() => {
    if (currentUserId && partnerId) {
      fetch(`${BASE_URL}/api/users/isBlocked?blockerId=${currentUserId}&blockedId=${partnerId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.isBlocked !== undefined) {
            setIsBlocked(data.isBlocked);
          }
        })
        .catch(err => console.log(err));
    }
  }, [currentUserId, partnerId]);

  const handleToggleBlock = () => {
    if (!isBlocked) {
      fetch(`${BASE_URL}/api/users/blockUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockerId: currentUserId, blockedId: partnerId }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.message) {
            Alert.alert('Уведомление', 'Пользователь заблокирован');
            setIsBlocked(true);
          }
        })
        .catch(err => console.log(err));
    } else {
      fetch(`${BASE_URL}/api/users/unblockUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockerId: currentUserId, blockedId: partnerId }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.message) {
            Alert.alert('Уведомление', 'Пользователь разблокирован');
            setIsBlocked(false);
          }
        })
        .catch(err => console.log(err));
    }
    setModalVisible(false);
  };

  const handleClearHistory = () => {
    Alert.alert('Уведомление', 'История сообщений очищена');
    setModalVisible(false);
  };

  const handleDeleteSelected = () => {
    onDeleteMessages(selectedMessages);
    setSelectedMessages([]);
    setMultiSelect(false);
    setModalVisible(false);
  };

  const handleEditSelected = () => {
    if (selectedMessages.length === 1) {
      const messageId = selectedMessages[0];
      const message = messages.find((m) => m.id === messageId);
      if (message && message.type === 'text' && String(message.fromUserId) === String(currentUserId)) {
        onEditMessage(messageId, message.text);
      }
    }
    setSelectedMessages([]);
    setMultiSelect(false);
    setModalVisible(false);
  };

  const handleCancelMultiSelect = () => {
    setSelectedMessages([]);
    setMultiSelect(false);
    setModalVisible(false);
  };

  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);

  const handleVideoCall = () => {
    setIsCalling(true);
    socket.emit('callUser', {
      to: partnerId,
      callerId: currentUserId,
      callerName: username,
      callerPicture: picture,
    });

    socket.once('callAccepted', () => {
      setIsCalling(false);
      navigation.navigate('OnVideoCallScreen', {
        partnerId,
        username,
        picture,
        isCaller: true,
      });
    });
    socket.once('callDeclined', () => {
      setIsCalling(false);
      Alert.alert('Звонок отклонён', 'Пользователь отклонил звонок');
    });
  };

  const handleCancelCall = () => {
    setIsCalling(false);
  };

  // Функция для определения статуса онлайн/печатает
  const getStatusText = () => {
    if (selectedMessages.length > 0) {
      return '';
    }
    if (typingUsers.includes(partnerId)) {
      return 'Печатает...';
    }
    return onlineStatus;
  };

  const statusText = getStatusText();
  const isTyping = statusText === 'Печатает...';

  return (
    <LinearGradient
      colors={isDarkMode
        ? ['#0B0F19', '#1A2233']
        : ['#5B3FE0', '#7C5CFF']
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.container}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => {
        if (selectedMessages.length > 0) {
          setSelectedMessages([]);
          setMultiSelect(false);
        } else {
          navigation.goBack();
        }
      }}>
        <Icon name="angle-left" size={28} color="#fff" />
      </TouchableOpacity>
      <View style={styles.profileOptions}>
        <TouchableOpacity
          style={styles.profile}
          onPress={() => {
            if (selectedMessages.length === 0) {
              navigation.navigate('UserProfileScreen', {
                userId: partnerId,
                username,
                picture,
              });
            }
          }}
        >
          {picture ? (
            <Image style={styles.image} source={{ uri: fixFileUrl(picture) }} />
          ) : (
            <View style={[styles.image, styles.avatarPlaceholder]}>
              <Text style={styles.avatarLetter}>{username?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <View style={styles.usernameAndOnlineStatus}>
            <Text style={styles.username} numberOfLines={1}>
              {selectedMessages.length > 0 ? `${selectedMessages.length} selected` : username}
            </Text>
            {statusText ? (
              <Text style={[styles.onlineStatus, isTyping && styles.typingStatus]}>
                {statusText}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
        <View style={styles.options}>
          <TouchableOpacity onPress={handleVideoCall} style={styles.headerIconButton}>
            <View style={styles.headerIconCircle}>
              <Icon name="phone" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
          {onSearchPress && (
            <TouchableOpacity onPress={onSearchPress} style={styles.headerIconButton}>
              <View style={styles.headerIconCircle}>
                <Icon name="search" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={openModal} style={styles.headerIconButton}>
            <View style={styles.headerIconCircle}>
              <Icon name="ellipsis-v" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <View style={[styles.modalContainer, isDarkMode && styles.modalContainerDark]}>
            {selectedMessages.length > 0 ? (
              <>
                <TouchableOpacity style={styles.modalButton} onPress={() => { setModalVisible(false); onForwardMessages?.(); }}>
                  <Text style={[styles.modalButtonText, { color: '#7C5CFF' }]}>
                    Переслать
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handleDeleteSelected}>
                  <Text style={[styles.modalButtonText, { color: '#EF4444' }]}>
                    Удалить ({selectedMessages.length})
                  </Text>
                </TouchableOpacity>
                {selectedMessages.length === 1 &&
                  messages.find((m) => m.id === selectedMessages[0])?.type === 'text' &&
                  String(messages.find((m) => m.id === selectedMessages[0])?.fromUserId) === String(currentUserId) && (
                    <TouchableOpacity style={styles.modalButton} onPress={handleEditSelected}>
                      <Text style={styles.modalButtonText}>Редактировать</Text>
                    </TouchableOpacity>
                  )}
                <TouchableOpacity style={[styles.modalButton, styles.modalCloseButton]} onPress={handleCancelMultiSelect}>
                  <Text style={[styles.modalButtonText, { color: '#94A3B8' }]}>Отмена</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.modalButton} onPress={handleToggleBlock}>
                  <Text style={[styles.modalButtonText, isBlocked ? { color: '#22C55E' } : { color: '#EF4444' }]}>
                    {isBlocked ? 'Разблокировать' : 'Заблокировать'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={handleClearHistory}>
                  <Text style={styles.modalButtonText}>Очистить историю</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.modalCloseButton]} onPress={closeModal}>
                  <Text style={[styles.modalButtonText, { color: '#94A3B8' }]}>Отмена</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
      {isCalling && <CallProgressModal visible={isCalling} onCancel={handleCancelCall} />}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 8,
  },
  backButton: {
    padding: 8,
  },
  profileOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  image: {
    height: 42,
    width: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  usernameAndOnlineStatus: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  onlineStatus: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    marginTop: 1,
  },
  typingStatus: {
    color: '#4ADE80',
    fontWeight: '500',
  },
  options: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconButton: {
    padding: 4,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalContainerDark: {
    backgroundColor: '#121826',
  },
  modalButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  modalButtonText: {
    fontSize: 15,
    color: '#7C5CFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  modalCloseButton: {
    borderBottomWidth: 0,
  },
});

// // components/chat/ChatHeader.jsx
// import React, { useState, useEffect } from 'react';
// import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Platform, Modal } from 'react-native';
// import Icon from '@expo/vector-icons/FontAwesome';
// import { useNavigation } from '@react-navigation/native';
// import { theme } from '../../theme';
// import { useTheme } from '../../ThemeContext';
// import socket from '../../src/socket';
// import CallProgressModal from '../../screens/CallProgressModal';
// import { BASE_URL } from "../../src/config";

// // const BASE_URL = Platform.select({ web: 'http://192.168.77.41:3000', default: 'http://192.168.77.41:3000' });

// export default function ChatHeader({
//   username: initialUsername,
//   bio,
//   picture: initialPicture,
//   onlineStatus,
//   currentUserId,
//   partnerId,
//   selectedMessages,
//   setSelectedMessages,
//   setMultiSelect,
//   onDeleteMessages,
//   onEditMessage,
//   messages,
// }) {
//   const navigation = useNavigation();
//   const { isDarkMode } = useTheme();

//   const [isModalVisible, setModalVisible] = useState(false);
//   const [isBlocked, setIsBlocked] = useState(false);
//   const [username, setUsername] = useState(initialUsername);
//   const [picture, setPicture] = useState(initialPicture);
//   const [isCalling, setIsCalling] = useState(false);

//   useEffect(() => {
//     setUsername(initialUsername);
//     setPicture(initialPicture);
//   }, [initialUsername, initialPicture]);

//   useEffect(() => {
//     const handleProfileUpdated = (data) => {
//       if (data.userId === partnerId) {
//         setUsername(data.username);
//         setPicture(data.avatar);
//       }
//     };

//     socket.on('profileUpdated', handleProfileUpdated);
//     return () => {
//       socket.off('profileUpdated', handleProfileUpdated);
//     };
//   }, [partnerId]);

//   useEffect(() => {
//     if (currentUserId && partnerId) {
//       fetch(`${BASE_URL}/api/users/isBlocked?blockerId=${currentUserId}&blockedId=${partnerId}`)
//         .then(res => res.json())
//         .then(data => {
//           if (data && data.isBlocked !== undefined) {
//             setIsBlocked(data.isBlocked);
//           }
//         })
//         .catch(err => console.log(err));
//     }
//   }, [currentUserId, partnerId]);

//   const handleToggleBlock = () => {
//     if (!isBlocked) {
//       fetch(`${BASE_URL}/api/users/blockUser`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ blockerId: currentUserId, blockedId: partnerId }),
//       })
//         .then(res => res.json())
//         .then(data => {
//           if (data.message) {
//             Alert.alert('Уведомление', 'Пользователь заблокирован');
//             setIsBlocked(true);
//           }
//         })
//         .catch(err => console.log(err));
//     } else {
//       fetch(`${BASE_URL}/api/users/unblockUser`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ blockerId: currentUserId, blockedId: partnerId }),
//       })
//         .then(res => res.json())
//         .then(data => {
//           if (data.message) {
//             Alert.alert('Уведомление', 'Пользователь разблокирован');
//             setIsBlocked(false);
//           }
//         })
//         .catch(err => console.log(err));
//     }
//     setModalVisible(false);
//   };

//   const handleClearHistory = () => {
//     Alert.alert('Уведомление', 'История сообщений очищена');
//     setModalVisible(false);
//   };

//   const handleDeleteSelected = () => {
//     onDeleteMessages(selectedMessages);
//     setSelectedMessages([]);
//     setMultiSelect(false);
//     setModalVisible(false);
//   };

//   const handleEditSelected = () => {
//     if (selectedMessages.length === 1) {
//       const messageId = selectedMessages[0];
//       const message = messages.find((m) => m.id === messageId);
//       if (message && message.type === 'text' && String(message.fromUserId) === String(currentUserId)) {
//         onEditMessage(messageId, message.text);
//       }
//     }
//     setSelectedMessages([]);
//     setMultiSelect(false);
//     setModalVisible(false);
//   };

//   const handleCancelMultiSelect = () => {
//     setSelectedMessages([]);
//     setMultiSelect(false);
//     setModalVisible(false);
//   };

//   const openModal = () => setModalVisible(true);
//   const closeModal = () => setModalVisible(false);

//   const handleVideoCall = () => {
//     setIsCalling(true);
//     socket.emit('callUser', {
//       to: partnerId,
//       callerId: currentUserId,
//       callerName: username,
//       callerPicture: picture,
//     });

//     socket.once('callAccepted', () => {
//       setIsCalling(false);
//       navigation.navigate('OnVideoCallScreen', {
//         partnerId,
//         username,
//         picture,
//         isCaller: true,
//       });
//     });
//     socket.once('callDeclined', () => {
//       setIsCalling(false);
//       Alert.alert('Звонок отклонён', 'Пользователь отклонил звонок');
//     });
//   };

//   const handleCancelCall = () => {
//     setIsCalling(false);
//   };

//   return (
//     <View style={[styles.container, { backgroundColor: theme.colors.primary }]}>
//       <TouchableOpacity style={styles.backButton}>
//         <Icon name="angle-left" size={30} color={theme.colors.white} onPress={() => {
//           if (selectedMessages.length > 0) {
//             setSelectedMessages([]);
//             setMultiSelect(false);
//           } else {
//             navigation.goBack();
//           }
//         }} />
//       </TouchableOpacity>
//       <View style={styles.profileOptions}>
//         <TouchableOpacity style={styles.profile} onPress={() => {}}>
//           <Image style={styles.image} source={{ uri: picture }} />
//           <View style={styles.usernameAndOnlineStatus}>
//             <Text style={styles.username}>
//               {selectedMessages.length > 0 ? `${selectedMessages.length} selected` : username}
//             </Text>
//             <Text style={styles.onlineStatus}>
//               {selectedMessages.length > 0 ? '' : onlineStatus}
//             </Text>
//           </View>
//         </TouchableOpacity>
//         <View style={styles.options}>
//           <TouchableOpacity onPress={handleVideoCall} style={{ paddingHorizontal: 10 }}>
//             <Icon name="phone" size={25} color={theme.colors.white} />
//           </TouchableOpacity>
//           <TouchableOpacity style={{ paddingHorizontal: 10 }} onPress={openModal}>
//             <Icon name="ellipsis-v" size={25} color={theme.colors.white} />
//           </TouchableOpacity>
//         </View>
//       </View>
//       <Modal
//         visible={isModalVisible}
//         transparent
//         animationType="fade"
//         onRequestClose={closeModal}
//       >
//         <TouchableOpacity
//           style={styles.modalOverlay}
//           activeOpacity={1}
//           onPress={closeModal}
//         >
//           <View style={styles.modalContainer}>
//             {selectedMessages.length > 0 ? (
//               <>
//                 <TouchableOpacity style={styles.modalButton} onPress={handleDeleteSelected}>
//                   <Text style={styles.modalButtonText}>Удалить ({selectedMessages.length})</Text>
//                 </TouchableOpacity>
//                 {selectedMessages.length === 1 &&
//                   messages.find((m) => m.id === selectedMessages[0])?.type === 'text' &&
//                   String(messages.find((m) => m.id === selectedMessages[0])?.fromUserId) === String(currentUserId) && (
//                     <TouchableOpacity style={styles.modalButton} onPress={handleEditSelected}>
//                       <Text style={styles.modalButtonText}>Редактировать</Text>
//                     </TouchableOpacity>
//                   )}
//                 <TouchableOpacity style={[styles.modalButton, styles.modalCloseButton]} onPress={handleCancelMultiSelect}>
//                   <Text style={styles.modalButtonText}>Отмена</Text>
//                 </TouchableOpacity>
//               </>
//             ) : (
//               <>
//                 <TouchableOpacity style={styles.modalButton} onPress={handleToggleBlock}>
//                   <Text style={styles.modalButtonText}>
//                     {isBlocked ? 'Разблокировать' : 'Заблокировать'}
//                   </Text>
//                 </TouchableOpacity>
//                 <TouchableOpacity style={styles.modalButton} onPress={handleClearHistory}>
//                   <Text style={styles.modalButtonText}>Очистить историю</Text>
//                 </TouchableOpacity>
//                 <TouchableOpacity style={[styles.modalButton, styles.modalCloseButton]} onPress={closeModal}>
//                   <Text style={styles.modalButtonText}>Отмена</Text>
//                 </TouchableOpacity>
//               </>
//             )}
//           </View>
//         </TouchableOpacity>
//       </Modal>
//       {isCalling && <CallProgressModal visible={isCalling} onCancel={handleCancelCall} />}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flexDirection: 'row',
//     paddingTop: 20,
//     paddingBottom: 10,
//   },
//   backButton: {
//     alignSelf: 'center',
//     paddingHorizontal: 10,
//   },
//   profileOptions: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     flex: 1,
//     paddingHorizontal: 10,
//   },
//   profile: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     flex: 4,
//   },
//   image: {
//     height: 45,
//     width: 45,
//     borderRadius: 32.5,
//   },
//   usernameAndOnlineStatus: {
//     flexDirection: 'column',
//     justifyContent: 'center',
//     paddingHorizontal: 10,
//   },
//   username: {
//     color: theme.colors.white,
//     fontSize: 18,
//     fontWeight: 'bold',
//   },
//   onlineStatus: {
//     color: theme.colors.white,
//     fontSize: 16,
//   },
//   options: {
//     flex: 1,
//     flexDirection: 'row',
//     justifyContent: 'flex-end',
//     alignItems: 'center',
//   },
//   modalOverlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   modalContainer: {
//     backgroundColor: '#fff',
//     borderRadius: 10,
//     padding: 20,
//     width: '80%',
//   },
//   modalButton: {
//     padding: 15,
//     borderBottomWidth: 1,
//     borderBottomColor: '#e0e0e0',
//   },
//   modalButtonText: {
//     fontSize: 16,
//     color: '#007bff',
//     textAlign: 'center',
//   },
//   modalCloseButton: {
//     borderBottomWidth: 0,
//   },
// });