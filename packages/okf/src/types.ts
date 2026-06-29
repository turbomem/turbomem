// OKF frontmatter — the structured fields every concept document can carry
export interface OKFFrontmatter {
  type: string;
  title?: string;
  description?: string;
  resource?: string;
  tags?: string[];
  timestamp?: string;
  [key: string]: unknown;
}

// A single parsed OKF concept document
export interface OKFDocument {
  path: string;
  relativePath: string;
  frontmatter: OKFFrontmatter;
  body: string;
  links: OKFLink[];
}

// A cross-link extracted from a document body
export interface OKFLink {
  text: string;
  href: string;
  resolvedPath?: string;
}

// A full parsed OKF bundle
export interface OKFBundle {
  root: string;
  documents: OKFDocument[];
  index: Map<string, OKFDocument>;
}

// Concept graph node
export interface OKFNode {
  document: OKFDocument;
  outgoing: OKFEdge[];
  incoming: OKFEdge[];
}

// Concept graph edge (a cross-link between two documents)
export interface OKFEdge {
  from: OKFDocument;
  to: OKFDocument;
  linkText: string;
}

// Concept graph
export interface OKFGraph {
  nodes: Map<string, OKFNode>;
  edges: OKFEdge[];
}

// Validation result
export interface OKFValidationResult {
  valid: boolean;
  errors: OKFValidationError[];
  warnings: OKFValidationWarning[];
}

export interface OKFValidationError {
  path: string;
  message: string;
  rule: string;
}

export interface OKFValidationWarning {
  path: string;
  message: string;
  rule: string;
}

// Options for parsing
export interface ParseOptions {
  ignore?: string[];
  followLinks?: boolean;
}

// Options for writing a document
export interface WriteOptions {
  overwrite?: boolean;
}
