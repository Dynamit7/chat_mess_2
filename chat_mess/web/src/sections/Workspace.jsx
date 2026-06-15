import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Rail from "../components/chat/Rail";
import ChatsSection from "./ChatsSection";
import GroupsSection from "./GroupsSection";
import ChannelsSection from "./ChannelsSection";
import StoriesSection from "./StoriesSection";
import ReelsSection from "./ReelsSection";
import SettingsModal from "../components/settings/SettingsModal";
import { CallProvider } from "../context/CallContext";
import CallOverlay from "../components/calls/CallOverlay";
import { UnreadProvider, useUnread } from "../context/UnreadContext";

// Top-level authenticated workspace: the rail switches between sections,
// each section fills the remaining two grid columns (sidebar + pane).
const SECTIONS = ["chats", "groups", "channels", "stories", "reels"];

function WorkspaceBody() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = SECTIONS.includes(searchParams.get("section")) ? searchParams.get("section") : "chats";
  const [section, setSection] = useState(initial);
  const [settingsOpen, setSettingsOpen] = useState(searchParams.get("settings") === "1");

  const openDM = useCallback((userId) => {
    setSearchParams({ to: String(userId) }, { replace: true });
    setSection("chats");
  }, [setSearchParams]);
  const { totals } = useUnread();

  return (
    <CallProvider>
      <div className="app-shell">
        <Rail
          section={section}
          onSection={setSection}
          onOpenSettings={() => setSettingsOpen(true)}
          badges={{ chats: totals.chats, groups: totals.groups, channels: totals.channels }}
        />
        {section === "chats" && <ChatsSection />}
        {section === "groups" && <GroupsSection onOpenDM={openDM} />}
        {section === "channels" && <ChannelsSection />}
        {section === "stories" && <StoriesSection />}
        {section === "reels" && <ReelsSection />}
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      </div>
      <CallOverlay />
    </CallProvider>
  );
}

export default function Workspace() {
  return (
    <UnreadProvider>
      <WorkspaceBody />
    </UnreadProvider>
  );
}
