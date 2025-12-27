/**
 * Human Supervision Protocol (HSP) - Core Type Definitions
 * 
 * This module defines the fundamental types used throughout the HSP implementation.
 * HSP is the safety and governance layer of PSAN, ensuring human control over AI agents.
 */

/**
 * Criticality levels for agent actions
 * Determines the level of human oversight required
 */
export enum CriticalityLevel {
  /** Routine operations - auto-approved with logging */
  LOW = 'LOW',
  /** Standard operations - async notification to human */
  MEDIUM = 'MEDIUM',
  /** Significant operations - requires human confirmation */
  HIGH = 'HIGH',
  /** Critical operations - requires multi-factor approval */
  CRITICAL = 'CRITICAL'
}

/**
 * Status of an HSP-supervised action
 */
export enum ActionStatus {
  PENDING = 'PENDING',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT'
}

/**
 * Represents an action requested by an AI agent
 */
export interface AgentAction {
  /** Unique identifier for this action */
  id: string;
  /** ID of the agent requesting the action */
  agentId: string;
  /** Type of action (e.g., 'transfer', 'sign', 'purchase') */
  type: string;
  /** Human-readable description of the action */
  description: string;
  /** Monetary or risk value associated with the action */
  value?: number;
  /** Currency or unit for the value */
  currency?: string;
  /** Target of the action (e.g., account, service, person) */
  target?: string;
  /** Additional metadata for the action */
  metadata?: Record<string, unknown>;
  /** Timestamp when action was requested */
  requestedAt: Date;
  /** Deadline for action execution (optional) */
  deadline?: Date;
}

/**
 * Result of HSP processing for an action
 */
export interface HSPResult {
  /** The original action */
  action: AgentAction;
  /** Assigned criticality level */
  criticalityLevel: CriticalityLevel;
  /** Whether human approval is required */
  requiresApproval: boolean;
  /** Current status of the action */
  status: ActionStatus;
  /** Reason for the classification */
  classificationReason: string;
  /** Unique session ID for audit trail */
  sessionId: string;
  /** Timestamp of HSP processing */
  processedAt: Date;
}

/**
 * Human approval response
 */
export interface HumanApproval {
  /** Session ID from HSP result */
  sessionId: string;
  /** Whether the action is approved */
  approved: boolean;
  /** ID of the human approver */
  approverId: string;
  /** Optional comment from the approver */
  comment?: string;
  /** Cryptographic signature of the approval */
  signature: string;
  /** Timestamp of approval */
  approvedAt: Date;
}

/**
 * Audit log entry for HSP actions
 */
export interface AuditEntry {
  /** Unique entry ID */
  id: string;
  /** Session ID linking related entries */
  sessionId: string;
  /** Type of event */
  eventType: 'REQUEST' | 'CLASSIFICATION' | 'APPROVAL_REQUEST' | 'APPROVAL_RESPONSE' | 'EXECUTION' | 'ERROR';
  /** Event timestamp */
  timestamp: Date;
  /** Actor (agent or human ID) */
  actorId: string;
  /** Event details */
  details: Record<string, unknown>;
  /** Hash of previous entry (for chain integrity) */
  previousHash?: string;
  /** Hash of this entry */
  hash: string;
}

/**
 * Configuration for HSP Engine
 */
export interface HSPConfig {
  /** Default criticality level for unclassified actions */
  defaultLevel: CriticalityLevel;
  /** Rules for escalating criticality based on action properties */
  escalationRules: EscalationRule[];
  /** Timeout for approval requests (ms) */
  approvalTimeout: number;
  /** Maximum agent-to-agent interactions before human checkpoint */
  maxAgentLoops: number;
  /** Enable cascade failure detection */
  cascadeDetection: boolean;
}

/**
 * Rule for escalating action criticality
 */
export interface EscalationRule {
  /** Condition function that triggers escalation */
  condition: (action: AgentAction) => boolean;
  /** Criticality level to assign if condition is met */
  level: CriticalityLevel;
  /** Optional reason for the escalation */
  reason?: string;
}

/**
 * Agent interaction tracking for anti-loop protection
 */
export interface AgentInteraction {
  /** Source agent ID */
  fromAgentId: string;
  /** Target agent ID */
  toAgentId: string;
  /** Interaction timestamp */
  timestamp: Date;
  /** Related session ID */
  sessionId: string;
  /** Depth of agent chain */
  chainDepth: number;
}

/**
 * Cascade failure detection result
 */
export interface CascadeAnalysis {
  /** Whether a cascade risk is detected */
  riskDetected: boolean;
  /** Risk severity (0-1) */
  severity: number;
  /** Affected agents */
  affectedAgents: string[];
  /** Recommended action */
  recommendation: 'PROCEED' | 'PAUSE' | 'ABORT';
  /** Analysis details */
  details: string;
}
