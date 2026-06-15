/** Group a personalized story list into per-owner buckets (mine first). */
export type Story = { id: number; userId?: number; fileUrl: string; caption?: string; type?: string; createdAt: string; owner?: { id: number; username: string; avatar?: string } };
export type StoryOwner = { userId: number; username: string; avatar?: string; stories: Story[]; latest?: string; hasUnviewed: boolean };

export function groupStories(stories: Story[], me: number, myUsername: string, viewed: Set<number>): StoryOwner[] {
  const map = new Map<number, StoryOwner>();
  for (const s of stories) {
    const uid = Number(s.userId ?? s.owner?.id);
    if (!map.has(uid)) {
      map.set(uid, { userId: uid, username: s.owner?.username || (uid === me ? myUsername : 'User'), avatar: s.owner?.avatar, stories: [], hasUnviewed: false });
    }
    map.get(uid)!.stories.push(s);
  }
  const list = [...map.values()].map((o) => {
    o.stories.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    o.hasUnviewed = o.userId !== me && o.stories.some((s) => !viewed.has(Number(s.id)));
    o.latest = o.stories[o.stories.length - 1]?.createdAt;
    return o;
  });
  list.sort((a, b) => {
    if (a.userId === me) return -1;
    if (b.userId === me) return 1;
    if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
    return new Date(b.latest || 0).getTime() - new Date(a.latest || 0).getTime();
  });
  return list;
}
