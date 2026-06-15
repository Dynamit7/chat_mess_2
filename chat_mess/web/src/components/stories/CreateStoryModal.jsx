import { useState, useRef } from "react";
import Modal from "../Modal";
import { IImage } from "../Icon";
import { storiesApi } from "../../api/client";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function CreateStoryModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const socket = useSocket();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f);
    setIsVideo(f.type.startsWith("video/"));
    setPreview(URL.createObjectURL(f));
  };

  const share = async () => {
    if (!file) return toast.error("Choose a photo or video first.");
    setBusy(true);
    try {
      const story = await storiesApi.create({ userId: user.userId, caption: caption.trim(), file });
      socket.emit("newStoryCreated", { userId: Number(user.userId) });
      toast.success("Story shared!");
      onCreated?.(story);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Couldn't share your story.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add to your story"
      onClose={onClose}
      width={460}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={share} disabled={busy || !file}>
            {busy ? <span className="spinner" /> : "Share story"}
          </button>
        </>
      }
    >
      <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={pick} />
      {!preview ? (
        <button className="story-dropzone" onClick={() => fileRef.current?.click()}>
          <IImage size={40} />
          <div style={{ fontWeight: 600, marginTop: 12 }}>Choose a photo or video</div>
          <div style={{ color: "var(--text-faint)", fontSize: 13, marginTop: 4 }}>Disappears after 24 hours</div>
        </button>
      ) : (
        <div className="story-preview">
          {isVideo ? <video src={preview} controls /> : <img src={preview} alt="preview" />}
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => fileRef.current?.click()}>
            Change
          </button>
        </div>
      )}
      <div className="field" style={{ marginTop: 16 }}>
        <input
          className="input"
          placeholder="Add a caption…"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={200}
        />
      </div>
    </Modal>
  );
}
