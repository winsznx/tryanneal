export default function MonoValue({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-mono text-caption text-ash-gray ${className}`}>{children}</span>
  );
}
