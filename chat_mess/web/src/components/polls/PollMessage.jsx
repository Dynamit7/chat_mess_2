import { useState, useEffect, useRef } from "react";
import { ICheck, IPoll, IBars } from "../Icon";
import { pollsApi } from "../../api/client";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import Avatar from "../Avatar";
import Modal from "../Modal";

// Renders a votable poll. Pass `pollId` (and optionally `initialPoll`).
export default function PollMessage({ pollId, initialPoll }) {
  const { user } = useAuth();
  const socket = useSocket();
  const me = Number(user.userId);

  const [poll, setPoll] = useState(initialPoll?.options ? initialPoll : null);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [showVoters, setShowVoters] = useState(false);
  const votedRef = useRef(false);

  const load = () => {
    if (!pollId) return;
    pollsApi.get(pollId, me).then((r) => setPoll(r.poll)).catch(() => {});
  };

  useEffect(() => { if (!poll?.options) load(); }, [pollId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep ref in sync so socket handler can read current voted state without stale closure
  useEffect(() => {
    if (poll) votedRef.current = poll.hasVoted || (poll.userVotedOptions || []).length > 0;
  }, [poll]);

  useEffect(() => {
    const onVoted = (d) => {
      if (Number(d.pollId) !== Number(pollId)) return;
      if (votedRef.current) {
        // Reload full data so voters list updates in real-time
        load();
      } else {
        // Non-voter: just update counts
        setPoll((p) => (p ? { ...p, totalVotes: d.totalVotes, options: p.options.map((o) => {
          const u = (d.options || []).find((x) => Number(x.id) === Number(o.id));
          return u ? { ...o, votesCount: u.votesCount, percentage: u.percentage } : o;
        }) } : p));
      }
    };
    socket.on("poll_voted", onVoted);
    return () => socket.off("poll_voted", onVoted);
  }, [socket, pollId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!poll) return <div className="poll-card loading"><span className="spinner" /></div>;

  const hasVoted = poll.hasVoted || (poll.userVotedOptions || []).length > 0;
  const showResults = hasVoted || poll.isClosed;
  const userVoted = new Set(poll.userVotedOptions || []);

  const toggle = (id) => {
    if (showResults) return;
    setSelected((s) => {
      const n = new Set(poll.allowMultipleAnswers ? s : []);
      if (s.has(id) && poll.allowMultipleAnswers) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const vote = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await pollsApi.vote(pollId, me, [...selected]);
      load(); // reload full data including voters
    } catch { /* keep selection */ } finally { setBusy(false); }
  };

  const retract = async () => {
    setBusy(true);
    try { await pollsApi.retract(pollId, me); setSelected(new Set()); load(); } catch {} finally { setBusy(false); }
  };

  return (
    <div className="poll-card">
      <div className="poll-top">
        <span className="poll-kind">{poll.isQuiz ? <><IBars size={13} /> Quiz</> : <><IPoll size={13} /> Poll</>}</span>
        {poll.isAnonymous && <span className="poll-kind dim">Anonymous</span>}
      </div>
      <div className="poll-q">{poll.question}</div>

      <div className="poll-options">
        {poll.options.map((o) => {
          const mine = userVoted.has(o.id) || selected.has(o.id);
          const isCorrect = poll.isQuiz && Number(poll.correctOptionIndex) === poll.options.indexOf(o);
          const voters = o.voters || [];
          return (
            <div key={o.id} className="poll-option-wrap">
              <button
                className={`poll-option ${mine ? "sel" : ""} ${showResults ? "voted" : ""} ${showResults && isCorrect ? "correct" : ""}`}
                onClick={() => toggle(o.id)}
                disabled={showResults}
              >
                {showResults && <span className="poll-bar" style={{ width: `${o.percentage || 0}%` }} />}
                <span className="poll-check">{mine && <ICheck size={13} />}</span>
                <span className="poll-otext">{o.text}</span>
                {showResults && <span className="poll-pct">{o.percentage || 0}%</span>}
              </button>
              {showResults && !poll.isAnonymous && voters.length > 0 && (
                <div className="poll-voters">
                  {voters.slice(0, 5).map((v) => (
                    <Avatar key={v.id} src={v.avatar} name={v.username} size={20} />
                  ))}
                  {voters.length > 5 && (
                    <span className="poll-voter-more">+{voters.length - 5}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {poll.isQuiz && showResults && poll.explanation && (
        <div className="poll-explain">💡 {poll.explanation}</div>
      )}

      <div className="poll-foot">
        <button className="poll-count poll-count-btn" onClick={() => setShowVoters(true)}>
          {poll.totalVotes || 0} vote{poll.totalVotes === 1 ? "" : "s"}
        </button>
        {!showResults ? (
          <button className="poll-vote-btn" onClick={vote} disabled={busy || selected.size === 0}>Vote</button>
        ) : !poll.isClosed ? (
          <button className="poll-retract" onClick={retract} disabled={busy}>Retract vote</button>
        ) : (
          <span className="poll-count">Closed</span>
        )}
      </div>

      {showVoters && (
        <VotersModal pollId={pollId} isAnonymous={poll.isAnonymous} onClose={() => setShowVoters(false)} />
      )}
    </div>
  );
}

function VotersModal({ pollId, isAnonymous, onClose }) {
  const [voters, setVoters] = useState(null);

  useEffect(() => {
    if (isAnonymous) { setVoters([]); return; }
    pollsApi.voters(pollId).then((r) => setVoters(r.voters || [])).catch(() => setVoters([]));
  }, [pollId, isAnonymous]);

  // Group by option
  const groups = voters
    ? Object.values(
        voters.reduce((acc, v) => {
          const key = v.option?.id;
          if (!acc[key]) acc[key] = { option: v.option, users: [] };
          acc[key].users.push(v.user);
          return acc;
        }, {})
      )
    : [];

  return (
    <Modal title="Проголосовали" onClose={onClose} width={360}>
      {voters === null ? (
        <div className="poll-voters-loading"><span className="spinner" /></div>
      ) : isAnonymous ? (
        <div className="poll-voters-anon">Анонимный опрос — имена скрыты</div>
      ) : groups.length === 0 ? (
        <div className="poll-voters-anon">Пока никто не голосовал</div>
      ) : (
        <div className="poll-voters-list">
          {groups.map(({ option, users }) => (
            <div key={option?.id} className="poll-voters-group">
              <div className="poll-voters-option-label">{option?.text}</div>
              {users.map((u) => (
                <div key={u.id} className="poll-voters-row">
                  <Avatar src={u.avatar} name={u.username} size={32} />
                  <span className="poll-voters-name">{u.username}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
