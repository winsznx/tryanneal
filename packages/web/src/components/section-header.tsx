export default function SectionHeader({
  label,
  title,
  className = "",
}: {
  label: string;
  title: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col ${className}`} style={{ gap: "16px" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--color-subtle-ash)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <h2
        style={{
          fontSize: "clamp(28px, 4vw, 52px)",
          fontWeight: 400,
          color: "var(--color-cloud-white)",
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
        }}
      >
        {title}
      </h2>
    </div>
  );
}
