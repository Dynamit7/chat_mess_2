// Animated aurora backdrop rendered behind the whole app.
export default function Aurora() {
  return (
    <div className="aurora" aria-hidden>
      <div className="orb" />
      <div className="grain" />
    </div>
  );
}
