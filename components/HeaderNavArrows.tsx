"use client";

export default function HeaderNavArrows() {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      aria-label="Volver atrás"
      title="Volver atrás"
      style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.24)",
        background: "rgba(255,255,255,0.10)",
        color: "#fff",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 9,
          height: 9,
          borderTop: "2px solid currentColor",
          borderLeft: "2px solid currentColor",
          transform: "rotate(-45deg)",
          display: "block",
          marginLeft: 3,
        }}
      />
    </button>
  );
}
