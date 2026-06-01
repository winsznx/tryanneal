export type Severity = "critical" | "high" | "medium" | "low" | "informational";

export type SlitherImpact = "High" | "Medium" | "Low" | "Informational" | "Optimization";
export type SlitherConfidence = "High" | "Medium" | "Low";

export interface SourceLocation {
  file: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  length: number;
}

export interface Finding {
  detector: string;
  severity: Severity;
  confidence: SlitherConfidence;
  description: string;
  locations: SourceLocation[];
  source: "slither" | "slither_builtin" | "tryanneal" | "aderyn" | "llm";
}

export interface SlitherElement {
  type: string;
  name: string;
  source_mapping: {
    start: number;
    length: number;
    filename_relative?: string;
    filename_absolute?: string;
    filename?: string;
    lines: number[];
  };
}

export interface SlitherDetector {
  check: string;
  impact: SlitherImpact;
  confidence: SlitherConfidence;
  description: string;
  elements: SlitherElement[];
}

export interface SlitherOutput {
  success: boolean;
  error: string | null;
  results: {
    detectors?: SlitherDetector[];
  };
}

export class SlitherError extends Error {
  constructor(message: string, public readonly code: "NOT_INSTALLED" | "TIMEOUT" | "INVALID_INPUT" | "PARSE_ERROR" | "EXEC_ERROR") {
    super(message);
    this.name = "SlitherError";
  }
}
