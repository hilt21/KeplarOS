import Link from "next/link";

export default function Page(): React.ReactElement {
  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-md)",
        padding: "var(--space-xl)",
      }}
    >
      <h1
        style={{
          fontSize: "var(--font-h1)",
          color: "var(--color-text-primary)",
          margin: 0,
        }}
      >
        KEPLAR Phase 2 Beta
      </h1>
      <p
        style={{
          fontSize: "var(--font-body)",
          color: "var(--color-text-secondary)",
          margin: 0,
        }}
      >
        AgentOS three-pane collaboration workspace — goal spaces, node boards, cards, and
        confirmations.
      </p>
      <Link
        href="/goal-spaces"
        style={{
          fontSize: "var(--font-small)",
          color: "var(--color-primary)",
          fontFamily: "var(--font-jetbrains-mono, monospace)",
          textDecoration: "none",
          borderBottom: "1px solid var(--color-primary)",
        }}
      >
        → open goal spaces
      </Link>
    </main>
  );
}
