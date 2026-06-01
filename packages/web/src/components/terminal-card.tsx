export default function TerminalCard({
  children,
  className = "",
  accentColor,
}: {
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
}) {
  return (
    <div
      className={`bg-slate-gray rounded-sm p-5 border border-white/5 transition-colors duration-150 ${className}`}
      style={accentColor ? { "--accent": accentColor } as React.CSSProperties : undefined}
    >
      {children}
    </div>
  );
}
