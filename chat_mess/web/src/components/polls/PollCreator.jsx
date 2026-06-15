import { useState } from "react";
import Modal from "../Modal";
import { IPlus, IClose, ICheck } from "../Icon";
import { pollsApi } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

// Create a poll inside a group or channel. `target` = { groupId } | { channelId }.
export default function PollCreator({ target, onClose, onCreated }) {
  const { user } = useAuth();
  const toast = useToast();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isQuiz, setIsQuiz] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);

  const setOpt = (i, v) => setOptions((o) => o.map((x, idx) => (idx === i ? v : x)));
  const addOpt = () => options.length < 10 && setOptions((o) => [...o, ""]);
  const removeOpt = (i) => options.length > 2 && setOptions((o) => o.filter((_, idx) => idx !== i));

  const submit = async () => {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) return toast.error("Enter a question.");
    if (opts.length < 2) return toast.error("Add at least 2 options.");
    setBusy(true);
    try {
      const payload = {
        userId: user.userId,
        ...target,
        question: question.trim(),
        options: opts,
        isAnonymous,
        allowMultipleAnswers: isQuiz ? false : allowMultiple,
        isQuiz,
        correctOptionIndex: isQuiz ? correct : undefined,
        explanation: isQuiz ? explanation.trim() : undefined,
      };
      const res = await pollsApi.create(payload);
      toast.success("Poll created!");
      onCreated?.(res);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Couldn't create poll.");
    } finally {
      setBusy(false);
    }
  };

  const Toggle = ({ label, sub, on, onClick, disabled }) => (
    <button className="toggle-row" onClick={onClick} disabled={disabled} style={disabled ? { opacity: 0.5 } : undefined}>
      <div><div className="toggle-title">{label}</div><div className="toggle-sub">{sub}</div></div>
      <span className={`switch ${on ? "on" : ""}`}><span className="knob" /></span>
    </button>
  );

  return (
    <Modal
      title="Create a poll"
      onClose={onClose}
      width={500}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? <span className="spinner" /> : "Create poll"}</button>
        </>
      }
    >
      <div className="field"><label>Question</label>
        <input className="input" placeholder="Ask something…" value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} autoFocus />
      </div>

      <div className="field" style={{ marginTop: 16 }}><label>Options</label>
        {options.map((o, i) => (
          <div key={i} className="poll-opt-input">
            {isQuiz && (
              <button className={`poll-correct ${correct === i ? "on" : ""}`} title="Mark correct" onClick={() => setCorrect(i)}>
                <ICheck size={14} />
              </button>
            )}
            <input className="input" placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOpt(i, e.target.value)} />
            {options.length > 2 && <button className="icon-btn" onClick={() => removeOpt(i)}><IClose size={15} /></button>}
          </div>
        ))}
        {options.length < 10 && (
          <button className="poll-add-opt" onClick={addOpt}><IPlus size={16} /> Add option</button>
        )}
      </div>

      {isQuiz && (
        <div className="field" style={{ marginTop: 14 }}><label>Explanation (optional)</label>
          <input className="input" placeholder="Shown after answering" value={explanation} maxLength={200} onChange={(e) => setExplanation(e.target.value)} />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
        <Toggle label="Anonymous voting" sub="Hide who voted for what" on={isAnonymous} onClick={() => setIsAnonymous((v) => !v)} />
        <Toggle label="Multiple answers" sub="Let people pick more than one" on={allowMultiple} onClick={() => setAllowMultiple((v) => !v)} disabled={isQuiz} />
        <Toggle label="Quiz mode" sub="One correct answer, revealed after voting" on={isQuiz} onClick={() => setIsQuiz((v) => !v)} />
      </div>
    </Modal>
  );
}
