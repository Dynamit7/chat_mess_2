// Lightweight inline icon set (feather-style), no external dependency.
const S = ({ children, size = 20, sw = 1.8, ...p }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    {children}
  </svg>
);

export const IShield = (p) => (
  <S {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </S>
);
export const IChat = (p) => (
  <S {...p}>
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
  </S>
);
export const ISearch = (p) => (
  <S {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </S>
);
export const IEdit = (p) => (
  <S {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </S>
);
export const ITrash = (p) => (
  <S {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </S>
);
export const IReply = (p) => (
  <S {...p}>
    <path d="M9 17l-5-5 5-5" />
    <path d="M4 12h11a5 5 0 0 1 5 5v1" />
  </S>
);
export const ISmile = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </S>
);
export const ISend = (p) => (
  <S {...p}>
    <path d="M22 2L11 13" />
    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
  </S>
);
export const IPlus = (p) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);
export const IPaperclip = (p) => (
  <S {...p}>
    <path d="M21.4 11.05l-9.2 9.2a5 5 0 0 1-7.07-7.07l9.19-9.2a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </S>
);
export const IClose = (p) => (
  <S {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </S>
);
export const IMore = (p) => (
  <S {...p}>
    <circle cx="12" cy="5" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="12" cy="19" r="1.4" />
  </S>
);
export const IArrowLeft = (p) => (
  <S {...p}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </S>
);
export const ILogout = (p) => (
  <S {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </S>
);
export const IPhone = (p) => (
  <S {...p}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.8.6 2.7.7a2 2 0 0 1 1.7 2.1z" />
  </S>
);
export const IVideo = (p) => (
  <S {...p}>
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="M22 8l-6 4 6 4V8z" />
  </S>
);
export const ICheck = (p) => (
  <S {...p}>
    <path d="M20 6L9 17l-5-5" />
  </S>
);
export const ICheckDouble = (p) => (
  <S {...p} viewBox="0 0 28 24">
    <path d="M2 12l5 5L18 6" />
    <path d="M11 17L22 6" />
  </S>
);
export const IFile = (p) => (
  <S {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </S>
);
export const IUser = (p) => (
  <S {...p}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </S>
);
export const ILock = (p) => (
  <S {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </S>
);
export const IMail = (p) => (
  <S {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 6l-10 7L2 6" />
  </S>
);
export const IKey = (p) => (
  <S {...p}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M10.7 12.3L21 2M16 7l3 3M14 9l3 3" />
  </S>
);
export const IUsers = (p) => (
  <S {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </S>
);
export const IHash = (p) => (
  <S {...p}>
    <path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />
  </S>
);
export const IBroadcast = (p) => (
  <S {...p}>
    <path d="M3 11l18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </S>
);
export const ICog = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </S>
);
export const ICamera = (p) => (
  <S {...p}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </S>
);
export const IImage = (p) => (
  <S {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </S>
);
export const IBell = (p) => (
  <S {...p}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </S>
);
export const IBars = (p) => (
  <S {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </S>
);
export const IPoll = (p) => (
  <S {...p}>
    <path d="M3 3v18h18" />
    <rect x="7" y="12" width="3" height="6" />
    <rect x="12" y="8" width="3" height="10" />
    <rect x="17" y="5" width="3" height="13" />
  </S>
);
export const IGlobe = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
  </S>
);
export const IBan = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </S>
);
export const IPlay = (p) => (
  <S {...p}>
    <path d="M6 4l14 8-14 8V4z" fill="currentColor" stroke="none" />
  </S>
);
export const IHeart = ({ filled, ...p }) => (
  <S {...p}>
    <path
      d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"
      fill={filled ? "currentColor" : "none"}
    />
  </S>
);
export const IShare = (p) => (
  <S {...p}>
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M16 6l-4-4-4 4M12 2v14" />
  </S>
);
export const IFilm = (p) => (
  <S {...p}>
    <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" />
    <path d="M7 3.5v17M17 3.5v17M2.5 9h19M2.5 15h19" />
  </S>
);
export const IVolume = (p) => (
  <S {...p}>
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <path d="M19 5a9 9 0 0 1 0 14M15.5 8.5a4 4 0 0 1 0 7" />
  </S>
);
export const IMute = (p) => (
  <S {...p}>
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <path d="M22 9l-6 6M16 9l6 6" />
  </S>
);
export const ICheckSquare = (p) => (
  <S {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 12l2 2 4-4" />
  </S>
);


