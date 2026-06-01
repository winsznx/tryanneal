export default function SectionContainer({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <>
      <style>{`
        .sc-inner { padding-left: 48px; padding-right: 48px; }
        @media (max-width: 768px) { .sc-inner { padding-left: 24px; padding-right: 24px; } }
      `}</style>
      <div
        className={`sc-inner ${className}`}
        style={{ maxWidth: "1440px", margin: "0 auto", ...style }}
      >
        {children}
      </div>
    </>
  );
}
