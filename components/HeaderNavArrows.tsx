"use client";

function Chevron({ direction }: { direction: "back" | "forward" }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 9,
        height: 9,
        borderTop: "2px solid currentColor",
        borderLeft: "2px solid currentColor",
        transform: direction === "back" ? "rotate(-45deg)" : "rotate(135deg)",
        display: "block",
        marginLeft: direction === "back" ? 3 : -3,
      }}
    />
  );
}

export default function HeaderNavArrows() {
  const buttonStyle: React.CSSProperties = {
    width: 38,
    height: 38,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.24)",
    background: "rgba(255,255,255,0.10)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={() => window.history.back()} aria-label="Volver atrás" title="Volver atrás" style={buttonStyle}>
        <Chevron direction="back" />
      </button>
      <button type="button" onClick={() => window.history.forward()} aria-label="Ir adelante" title="Ir adelante" style={buttonStyle}>
        <Chevron direction="forward" />
      </button>
    </div>
  );
}
