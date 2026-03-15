/**
 * Axe-core compatible result types.
 * These match axe-core's output format exactly for drop-in compatibility.
 */

export type ImpactValue = "minor" | "moderate" | "serious" | "critical";

export interface TestEngine {
  name: string;
  version: string;
}

export interface TestRunner {
  name: string;
}

export interface TestEnvironment {
  userAgent: string;
  windowWidth: number;
  windowHeight: number;
  orientationAngle?: number;
  orientationType?: string;
}

export interface RelatedNode {
  html: string;
  target: string[];
}

export interface CheckResult {
  id: string;
  impact: ImpactValue;
  message: string;
  data: any;
  relatedNodes: RelatedNode[];
}

export interface NodeResult {
  html: string;
  impact?: ImpactValue;
  target: string[];
  any: CheckResult[];
  all: CheckResult[];
  none: CheckResult[];
  failureSummary?: string;
}

export interface RuleResult {
  id: string;
  impact?: ImpactValue | null;
  tags: string[];
  description: string;
  help: string;
  helpUrl: string;
  nodes: NodeResult[];
}

export interface AxeResults {
  testEngine: TestEngine;
  testRunner: TestRunner;
  testEnvironment: TestEnvironment;
  url: string;
  timestamp: string;
  toolOptions: Record<string, any>;
  passes: RuleResult[];
  violations: RuleResult[];
  incomplete: RuleResult[];
  inapplicable: RuleResult[];
}

export interface RunOptions {
  runOnly?: {
    type: "tag" | "rule";
    values: string[];
  };
  rules?: Record<string, { enabled: boolean }>;
  include?: string[];
  exclude?: string[];
}
