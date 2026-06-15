// PM2 конфигурация для горизонтального масштабирования чат-сервера.
//
// Почему fork, а не cluster?
//   В режиме "cluster" PM2 балансирует соединения встроенным механизмом,
//   но он НЕ гарантирует sticky sessions. Socket.IO при HTTP long-polling
//   делает несколько запросов в рамках одного handshake — они должны попасть
//   на ОДИН и тот же процесс. Без этого появляются ошибки
//   "Session ID unknown". Поэтому запускаем несколько процессов в режиме
//   "fork", каждый на своём порту, а "липкость" обеспечивает Nginx
//   (upstream ip_hash, см. nginx.conf).
//
// Запуск:   pm2 start ecosystem.config.js
// Логи:     pm2 logs chat-api
// Рестарт:  pm2 reload chat-api      (zero-downtime)
// Стоп:     pm2 stop chat-api
// Автозапуск при загрузке ОС:  pm2 startup && pm2 save

module.exports = {
  apps: [
    {
      name: "chat-api",
      script: "./app.js",
      cwd: __dirname,

      // Несколько независимых процессов на портах 3000, 3001, 3002, 3003...
      // Поставьте instances = числу ядер CPU (но обычно достаточно 4–8;
      // на этой машине доступно 32 ядра — начните, например, с 4–8).
      exec_mode: "fork",
      instances: 4,
      // Порт вычисляется в app.js как PORT + NODE_APP_INSTANCE (3000..3003).
      // increment_var НЕ используем — он капризен и приводил к тому, что все
      // инстансы лезли на 3000 (EADDRINUSE) и падали в крэш-цикл.

      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },

      autorestart: true,
      watch: false,
      max_memory_restart: "600M", // перезапуск процесса при утечке памяти
      kill_timeout: 5000, // дать времени корректно закрыть сокеты
      exp_backoff_restart_delay: 200, // экспоненциальная задержка при крашах
      merge_logs: true,
      time: true, // таймстампы в логах
    },
  ],
};
