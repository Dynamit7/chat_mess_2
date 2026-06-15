// i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        "Имя": "First Name",
        "Фамилия": "Last Name",
        "Настройки чата": "Chat Settings",
        "Конфиденциальность": "Privacy",
        "Язык": "Language",
        "chat": "Chat",
        "weather": "Weather",
        "humidity": "Humidity",
        "windspeed": "Wind Speed",
        "close": "Close",
        "messages": "Messages",
        "stories": "Stories",
        "calls": "Calls",
        "Create Channel": "Create Channel",
        "Create Group": "Create Group",
        "Privacy": "Privacy",
        "Language": "Language",
        "Save_Profile": "Save Profile",
        "channels": "Channels",
        "groups": "Groups",
        "Profile": "Profile",
        "Settings": "Settings",
        "Logout": "Logout",
        "Select Language": "Select Language",
        "Close": "Close"
      }
    },
    ru: {
      translation: {
        "Имя": "Имя",
        "Фамилия": "Фамилия",
        "Настройки чата": "Настройки чата",
        "Конфиденциальность": "Конфиденциальность",
        "Язык": "Язык",
        "chat": "Чат",
        "weather": "Погода",
        "humidity": "Влажность",
        "windspeed": "Скорость ветра",
        "close": "Закрыть",
        "messages": "Сообщения",
        "stories": "Истории",
        "calls": "Звонки",
        "Create Channel": "Создать канал",
        "Create Group": "Создать группу",
        "Privacy": "Конфиденциальность",
        "Language": "Язык",
        "Save_Profile": "Сохранить",
        "channels": "Каналы",
        "groups": "Группы",
        "Profile": "Профиль",
        "Settings": "Настройки",
        "Logout": "Выйти",
        "Select Language": "Выберите язык",
        "Close": "Закрыть"
      }
    }
  },
  lng: "ru", 
  fallbackLng: "en",
  interpolation: {
    escapeValue: false 
  }
});

export default i18n;
