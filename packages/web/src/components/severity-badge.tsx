type Severity = "critical" | "high" | "medium" | "low" | "informational" | "safe";

const config: Record<Severity, { label: string; classes: string }> = {
  critical: {
    label: "Critical",
    classes: "bg-severity-critical/10 text-severity-critical border border-severity-critical/30",
  },
  high: {
    label: "High",
    classes: "bg-severity-high/10 text-severity-high border border-severity-high/30",
  },
  medium: {
    label: "Medium",
    classes: "bg-severity-medium/10 text-severity-medium border border-severity-medium/30",
  },
  low: {
    label: "Low",
    classes: "bg-severity-low/10 text-severity-low border border-severity-low/30",
  },
  informational: {
    label: "Info",
    classes: "bg-severity-info/10 text-severity-info border border-severity-info/30",
  },
  safe: {
    label: "Safe",
    classes: "bg-severity-safe/10 text-severity-safe border border-severity-safe/30",
  },
};

export default function SeverityBadge({ severity }: { severity: Severity }) {
  const { label, classes } = config[severity] ?? config.informational;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm text-micro font-mono uppercase tracking-wider ${classes}`}
    >
      {label}
    </span>
  );
}
