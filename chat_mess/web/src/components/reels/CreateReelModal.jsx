import { useState, useRef } from "react";
import Modal from "../Modal";
import { IFilm } from "../Icon";
import { reelsApi } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function CreateReelModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("video/")) return toast.error("Please choose a video.");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const share = async () => {
    if (!file) return toast.error("Choose a video first.");
    setBusy(true);
    try {
      const hashtags = (caption.match(/#(\w+)/g) || []).map((t) => t.slice(1).toLowerCase());
      const reel = await reelsApi.create({ userId: user.userId, caption: caption.trim(), hashtags, video: file });
      toast.success("Reel posted!");
      onCreated?.(reel);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Couldn't post your reel.");
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title="New reel"
      onClose={onClose}
      width={460}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={share} disabled={busy || !file}>{busy ? <span className="spinner" /> : "Post reel"}</button>
        </>
      }
    >
      <input ref={fileRef} type="file" accept="video/*" hidden onChange={pick} />
      {!preview ? (
        <button className="story-dropzone" onClick={() => fileRef.current?.click()}>
          <IFilm size={40} />
          <div style={{ fontWeight: 600, marginTop: 12 }}>Choose a video</div>
          <div style={{ color: "var(--text-faint)", fontSize: 13, marginTop: 4 }}>Vertical videos look best</div>
        </button>
      ) : (
        <div className="story-preview">
          <video src={preview} controls style={{ maxHeight: 320 }} />
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => fileRef.current?.click()}>Change video</button>
        </div>
      )}
      <div className="field" style={{ marginTop: 16 }}>
        <textarea className="input" style={{ height: 76, paddingTop: 12, resize: "none" }} placeholder="Write a caption… use #hashtags" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} />
      </div>
    </Modal>
  );
}
