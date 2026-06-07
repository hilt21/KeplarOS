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
        KEPLAR Phase 1 S1 Ready
      </h1>
      <p
        style={{
          fontSize: "var(--font-body)",
          color: "var(--color-text-secondary)",
          margin: 0,
        }}
      >
        脚手架与基础设施已就绪。后续 S2 领域核心、S3 API/SSE、S4 Dashboard 将在此基础上增量交付。
      </p>
      <code
        style={{
          fontSize: "var(--font-small)",
          color: "var(--color-primary)",
          fontFamily: "var(--font-jetbrains-mono, monospace)",
        }}
      >
        branch: 20260606-dev-bootstrap · change: 20260606-s1-scaffold
      </code>
    </main>
  );
}
