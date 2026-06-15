import React, { useEffect, useState } from "react";
import { fetchOverview } from "../api.js";

const Stat = ({ label, value, foot, accent }) => (
  <div className="stat">
    <div className="label">{label}</div>
    <div className={`value ${accent ? "accent" : ""}`}>{value}</div>
    {foot && <div className="foot">{foot}</div>}
  </div>
);

export default function Overview({ liveCount }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    const tick = () => fetchOverview().then((d) => alive && setData(d)).catch(() => {});
    tick();
    const t = setInterval(tick, 10000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!data) return <div className="loading">Загрузка статистики…</div>;
  const m = data.messages;
  return (
    <div>
      <div className="stat-grid">
        <Stat label="Пользователи" value={data.users} foot={`${data.online} онлайн`} accent />
        <Stat label="Онлайн сейчас" value={data.online} foot="активные сессии" />
        <Stat label="Группы" value={data.groups} />
        <Stat label="Каналы" value={data.channels} />
        <Stat label="Перехвачено в эфире" value={liveCount} foot="с момента входа" accent />
      </div>

      <div className="section-title">Сообщения на платформе</div>
      <div className="stat-grid">
        <Stat label="Всего сообщений" value={data.totalMessages.toLocaleString("ru-RU")} accent />
        <Stat label="Личные" value={m.direct.toLocaleString("ru-RU")} foot="DM" />
        <Stat label="Групповые" value={m.group.toLocaleString("ru-RU")} />
        <Stat label="В каналах" value={m.channel.toLocaleString("ru-RU")} />
      </div>
    </div>
  );
}
