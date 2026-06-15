import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";

import { useTranslation } from "react-i18next";
import ConversationsScreen from "../screens/ConversationsScreen";
import StoriesScreen from "../screens/StoriesScreen";
import GroupsListScreen from "../screens/GroupsListScreen";
import { useTheme } from "../ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ChannelsListScreen from "../screens/ChannelsListScreen";
import emitter from "../screens/eventEmitter";

const Tab = createMaterialTopTabNavigator();

export default function HomeNavigator() {
  const { isDarkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const [totalUnread, setTotalUnread] = useState(0);
  const [totalUnreadGroups, setTotalUnreadGroups] = useState(0);
  const [totalUnreadChannels, setTotalUnreadChannels] = useState(0);
  const [totalUnreadStories, setTotalUnreadStories] = useState(0);

  useEffect(() => {
    const loadLanguage = async () => {
      const savedLanguage = await AsyncStorage.getItem("language");
      if (savedLanguage) {
        i18n.changeLanguage(savedLanguage);
      }
    };
    loadLanguage();
  }, []);

  useEffect(() => {
    const handler = (count) => setTotalUnread(count);
    emitter.on('totalUnread', handler);
    return () => emitter.off('totalUnread', handler);
  }, []);

  useEffect(() => {
    const handler = (count) => setTotalUnreadGroups(count);
    emitter.on('totalUnreadGroups', handler);
    return () => emitter.off('totalUnreadGroups', handler);
  }, []);

  useEffect(() => {
    const handler = (count) => setTotalUnreadChannels(count);
    emitter.on('totalUnreadChannels', handler);
    return () => emitter.off('totalUnreadChannels', handler);
  }, []);

  useEffect(() => {
    const handler = (count) => setTotalUnreadStories(count);
    emitter.on('totalUnreadStories', handler);
    return () => emitter.off('totalUnreadStories', handler);
  }, []);

  return (
    <Tab.Navigator
      initialRouteName="Conversations"
      sceneContainerStyle={{
        backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF',
      }}
      screenOptions={{
        tabBarActiveTintColor: isDarkMode ? '#FFFFFF' : '#5B3FE0',
        tabBarInactiveTintColor: isDarkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(121, 40, 202, 0.4)',
        tabBarShowLabel: false,
        tabBarShowIcon: true,
        tabBarStyle: {
          backgroundColor: isDarkMode ? 'transparent' : '#FFFFFF',
          elevation: isDarkMode ? 0 : 2,
          shadowOpacity: isDarkMode ? 0 : 0.1,
          borderBottomWidth: 0,
          height: 48,
        },
        tabBarIndicatorStyle: {
          backgroundColor: isDarkMode ? '#FFFFFF' : '#5B3FE0',
          height: 3,
          borderRadius: 3,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
          height: 48,
          justifyContent: 'center',
        },
        tabBarBackground: isDarkMode ? () => (
          <LinearGradient
            colors={['#0B0F19', '#1A2233', '#0B0F19']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        ) : undefined,
      }}
    >
      <Tab.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={{
          tabBarLabel: t("messages"),
          tabBarIcon: ({ color }) => (
            <View>
              <Icon name="chat" size={22} color={color} />
              {totalUnread > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -8,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: '#EF4444',
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 2,
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Stories"
        component={StoriesScreen}
        options={{
          tabBarLabel: t("stories"),
          tabBarIcon: ({ color }) => (
            <View>
              <Icon name="book-open" size={22} color={color} />
              {totalUnreadStories > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -8,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: '#EF4444',
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 2,
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                    {totalUnreadStories > 99 ? '99+' : totalUnreadStories}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Channels"
        component={ChannelsListScreen}
        options={{
          tabBarLabel: t("channels"),
          tabBarIcon: ({ color }) => (
            <View>
              <Icon name="account-group" size={22} color={color} />
              {totalUnreadChannels > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -8,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: '#EF4444',
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 2,
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                    {totalUnreadChannels > 99 ? '99+' : totalUnreadChannels}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Groups"
        component={GroupsListScreen}
        options={{
          tabBarLabel: t("groups"),
          tabBarIcon: ({ color }) => (
            <View>
              <Icon name="group" size={22} color={color} />
              {totalUnreadGroups > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -8,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: '#EF4444',
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 2,
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                    {totalUnreadGroups > 99 ? '99+' : totalUnreadGroups}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
