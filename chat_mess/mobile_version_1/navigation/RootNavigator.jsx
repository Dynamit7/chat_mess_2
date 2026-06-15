import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import LoginScreen from "../screens/LoginScreen";
import SignUpScreen from "../screens/SignUpScreen";
import HomeScreen from "../screens/HomeScreen";
import MessagesScreen from "../screens/MessagesScreen";
import OnCallScreen from "../screens/OnCallScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ChatSettingsScreen from "../screens/ChatSettingsScreen";
import ProfScren2 from "../screens/ProfScren2";

import HomeNavigator from "./HomeNavigator";
import Header from "../components/common/Header";
import PrivacyScreen from "../screens/PrivacyScreen";
import NewSetChat from "../screens/NewSetChat";

import AuthLoadingScreen from "../screens/AuthLoadingScreen";

import GroupsListScreen from "../screens/GroupsListScreen";
import CreateGroupScreen from "../screens/CreateGroupScreen";
import GroupChatScreen from "../screens/GroupChatScreen";
import GroupProfileScreen from "../screens/GroupProfileScreen";
import GroupEditScreen from "../screens/GroupEditScreen";

import ChannelsListScreen from "../screens/ChannelsListScreen";
import CreateChannelScreen from "../screens/CreateChannelScreen";
import ChannelChatScreen from "../screens/ChannelChatScreen";
import ChannelProfileScreen from "../screens/ChannelProfileScreen";
import ChannelEditScreen from "../screens/ChannelEditScreen";
import ChannelCommentsScreen from "../screens/ChannelCommentsScreen";
import StoryPreview from "../screens/StoryPreview";

import OnVideoCallScreen from "../screens/OnVideoCallScreen";
import IncomingCallScreen from "../screens/IncomingCallScreen";
import VerifyCodeScreen from "../screens/VerifyCodeScreen";
import TwoFactorVerifyScreen from "../screens/TwoFactorVerifyScreen";
import UserProfileScreen from "../screens/UserProfileScreen";
import TranslationSettingsScreen from "../screens/TranslationSettingsScreen";

import { MenuProvider } from "react-native-popup-menu";
import { useTheme } from "../ThemeContext";

const Stack = createStackNavigator();

export default function RootNavigator() {
  const { isDarkMode } = useTheme();
  return (
    <MenuProvider>
      <Stack.Navigator
        initialRouteName="AuthLoading"
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF' },
        }}
      >
        <Stack.Screen name="AuthLoading" component={AuthLoadingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen
          name="Home"
          component={HomeNavigator}
          options={{
            headerShown: true,
            header: ({ navigation }) => (
              <Header title="Chat" navigation={navigation} />
            ),
          }}
        />
        <Stack.Screen 
          name="MessagesScreen" 
          component={MessagesScreen}
          options={{
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            animationEnabled: true,
          }}
        />
        <Stack.Screen name="PrivacyScreen" component={PrivacyScreen} />
        <Stack.Screen name="OnCallScreen" component={OnCallScreen} options={{presentation: 'modal', headerShown: false}} />
        {/* <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} /> */}
        <Stack.Screen
          name="ProfScren2"
          component={ProfScren2}
          options={{ title: "Профиль" }}
        />
        <Stack.Screen name="ChatSettings" component={ChatSettingsScreen} />
        <Stack.Screen name="NewSetChat" component={NewSetChat} />
        <Stack.Screen
          name="GroupsListScreen"
          component={GroupsListScreen}
          options={{
            headerShown: true,
            header: ({ navigation }) => (
              <Header title="Группы" navigation={navigation} />
            ),
          }}
        />
        <Stack.Screen name="CreateGroupScreen" component={CreateGroupScreen} />
        <Stack.Screen name="GroupChatScreen" component={GroupChatScreen} />
        <Stack.Screen name="GroupEditScreen" component={GroupEditScreen} />
        <Stack.Screen
          name="GroupProfileScreen"
          component={GroupProfileScreen}
          options={{ title: "Профиль группы" }}
        />

        <Stack.Screen
          name="ChannelsListScreen"
          component={ChannelsListScreen}
          options={{
            headerShown: true,
            header: ({ navigation }) => (
              <Header title="Каналы" navigation={navigation} />
            ),
          }}
        />

        <Stack.Screen name="CreateChannelScreen" component={CreateChannelScreen} />
        <Stack.Screen name="ChannelChatScreen" component={ChannelChatScreen} />
        <Stack.Screen name="ChannelEditScreen" component={ChannelEditScreen} />
        <Stack.Screen
          name="ChannelProfileScreen"
          component={ChannelProfileScreen}
          options={{ title: "Профиль канала" }}
        />

        <Stack.Screen name="ChannelCommentsScreen" component={ChannelCommentsScreen} />


        <Stack.Screen name="StoryPreview" component={StoryPreview} options={{ headerShown: false }} />
        <Stack.Screen name="OnVideoCallScreen" component={OnVideoCallScreen} options={{ headerShown: false }} />
        <Stack.Screen name="IncomingCallScreen" component={IncomingCallScreen} options={{ headerShown: false }} />

        <Stack.Screen name="VerifyCodeScreen" component={VerifyCodeScreen} />
        <Stack.Screen name="TwoFactorVerifyScreen" component={TwoFactorVerifyScreen} />
        <Stack.Screen name="UserProfileScreen" component={UserProfileScreen} />
        <Stack.Screen name="TranslationSettings" component={TranslationSettingsScreen} />

      </Stack.Navigator>
    </MenuProvider>
  );
}
