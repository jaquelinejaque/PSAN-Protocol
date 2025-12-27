/**
 * Human Supervision Protocol (HSP) - Engine Implementation
 * 
 * The HSP Engine is the core component that processes agent actions,
 * classifies their criticality, and manages the approval workflow.
 */

import {
  CriticalityLevel,
  ActionStatus,
  AgentAction,
  HSPResult,
  HumanApproval,
  AuditEntry,
  HSPConfig,
  AgentInteraction,
  CascadeAnalysis
} from './types';
import { createHash, randomUUID } from 'crypto';

/**
 * Default HSP configuration
 */
const DEFAULT_CONFIG: HSPConfig = {
  defaultLevel: CriticalityLevel.MEDIUM,
  escalationRules: [],
  approvalTimeout: 300000, // 5 minutes
  maxAgentLoops: 10,
  cascadeDetection: true
};

/**
 * HSP Engine - Main processing class
 */
export class HSPEngine {
  private config: HSPConfig;
  private auditLog: AuditEntry[] = [];
  private pendingApprovals: Map<string, HSPResult> = new Map();
  private agentInteractions: AgentInteraction[] = [];

  constructor(config: Partial<HSPConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process an agent action through the HSP pipeline
   */
  async process(action: AgentAction): Promise<HSPResult> {
    const sessionId = randomUUID();
    
    // Log the request
    this.addAuditEntry({
      sessionId,
      eventType: 'REQUEST',
      actorId: action.agentId,
      details: { action }
    });

    // Check for cascade risks
    if (this.config.cascadeDetection) {
      const cascadeAnalysis = this.analyzeCascadeRisk(action);
      if (cascadeAnalysis.recommendation === 'ABORT') {
        return this.createResult(action, sessionId, {
          criticalityLevel: CriticalityLevel.CRITICAL,
          requiresApproval: true,
          status: ActionStatus.AWAITING_APPROVAL,
          classificationReason: `Cascade risk detected: ${cascadeAnalysis.details}`
        });
      }
    }

    // Check anti-loop protection
    const loopCheck = this.checkAgentLoop(action, sessionId);
    if (loopCheck.exceeded) {
      return this.createResult(action, sessionId, {
        criticalityLevel: CriticalityLevel.CRITICAL,
        requiresApproval: true,
        status: ActionStatus.AWAITING_APPROVAL,
        classificationReason: `Agent loop limit exceeded: ${loopCheck.depth} interactions`
      });
    }

    // Classify the action
    const classification = this.classify(action);

    // Log classification
    this.addAuditEntry({
      sessionId,
      eventType: 'CLASSIFICATION',
      actorId: 'hsp-engine',
      details: { 
        level: classification.level, 
        reason: classification.reason 
      }
    });

    // Determine if approval is required
    const requiresApproval = classification.level === CriticalityLevel.HIGH || 
                             classification.level === CriticalityLevel.CRITICAL;

    const result = this.createResult(action, sessionId, {
      criticalityLevel: classification.level,
      requiresApproval,
      status: requiresApproval ? ActionStatus.AWAITING_APPROVAL : ActionStatus.APPROVED,
      classificationReason: classification.reason
    });

    if (requiresApproval) {
      this.pendingApprovals.set(sessionId, result);
      this.addAuditEntry({
        sessionId,
        eventType: 'APPROVAL_REQUEST',
        actorId: 'hsp-engine',
        details: { 
          level: classification.level,
          timeout: this.config.approvalTimeout
        }
      });
    }

    return result;
  }

  /**
   * Process human approval for a pending action
   */
  async processApproval(approval: HumanApproval): Promise<HSPResult> {
    const pending = this.pendingApprovals.get(approval.sessionId);
    
    if (!pending) {
      throw new Error(`No pending approval found for session: ${approval.sessionId}`);
    }

    // Verify approval signature (simplified - real implementation would use crypto)
    if (!this.verifySignature(approval)) {
      throw new Error('Invalid approval signature');
    }

    // Log approval response
    this.addAuditEntry({
      sessionId: approval.sessionId,
      eventType: 'APPROVAL_RESPONSE',
      actorId: approval.approverId,
      details: {
        approved: approval.approved,
        comment: approval.comment
      }
    });

    // Update result
    const result: HSPResult = {
      ...pending,
      status: approval.approved ? ActionStatus.APPROVED : ActionStatus.REJECTED
    };

    this.pendingApprovals.delete(approval.sessionId);

    return result;
  }

  /**
   * Execute an approved action
   */
  async execute(result: HSPResult): Promise<void> {
    if (result.status !== ActionStatus.APPROVED) {
      throw new Error(`Cannot execute action with status: ${result.status}`);
    }

    this.addAuditEntry({
      sessionId: result.sessionId,
      eventType: 'EXECUTION',
      actorId: result.action.agentId,
      details: { action: result.action }
    });

    // Track agent interaction
    this.trackAgentInteraction(result);
  }

  /**
   * Classify an action's criticality level
   */
  private classify(action: AgentAction): { level: CriticalityLevel; reason: string } {
    // Check escalation rules in order
    for (const rule of this.config.escalationRules) {
      if (rule.condition(action)) {
        return {
          level: rule.level,
          reason: rule.reason || `Matched escalation rule`
        };
      }
    }

    // Apply default classification based on action type
    const typeClassification = this.classifyByType(action);
    if (typeClassification) {
      return typeClassification;
    }

    return {
      level: this.config.defaultLevel,
      reason: 'Default classification applied'
    };
  }

  /**
   * Classify based on action type
   */
  private classifyByType(action: AgentAction): { level: CriticalityLevel; reason: string } | null {
    const criticalTypes = ['transfer', 'sign', 'delete', 'authorize'];
    const highTypes = ['purchase', 'modify', 'share'];
    const lowTypes = ['query', 'read', 'list'];

    if (criticalTypes.includes(action.type)) {
      return { level: CriticalityLevel.CRITICAL, reason: `Critical action type: ${action.type}` };
    }
    if (highTypes.includes(action.type)) {
      return { level: CriticalityLevel.HIGH, reason: `High-risk action type: ${action.type}` };
    }
    if (lowTypes.includes(action.type)) {
      return { level: CriticalityLevel.LOW, reason: `Low-risk action type: ${action.type}` };
    }

    return null;
  }

  /**
   * Check for agent interaction loops
   */
  private checkAgentLoop(action: AgentAction, sessionId: string): { exceeded: boolean; depth: number } {
    const recentInteractions = this.agentInteractions
      .filter(i => Date.now() - i.timestamp.getTime() < 60000) // Last minute
      .filter(i => i.fromAgentId === action.agentId || i.toAgentId === action.agentId);

    const depth = recentInteractions.length;

    return {
      exceeded: depth >= this.config.maxAgentLoops,
      depth
    };
  }

  /**
   * Analyze cascade failure risk
   */
  private analyzeCascadeRisk(action: AgentAction): CascadeAnalysis {
    // Simplified cascade analysis - real implementation would be more sophisticated
    const recentFailures = this.auditLog
      .filter(e => e.eventType === 'ERROR')
      .filter(e => Date.now() - e.timestamp.getTime() < 300000); // Last 5 minutes

    const severity = Math.min(recentFailures.length / 10, 1);
    const affectedAgents = [...new Set(recentFailures.map(e => e.actorId))];

    return {
      riskDetected: severity > 0.5,
      severity,
      affectedAgents,
      recommendation: severity > 0.8 ? 'ABORT' : severity > 0.5 ? 'PAUSE' : 'PROCEED',
      details: `${recentFailures.length} failures in last 5 minutes`
    };
  }

  /**
   * Track agent interaction for loop detection
   */
  private trackAgentInteraction(result: HSPResult): void {
    if (result.action.target && result.action.target.startsWith('agent-')) {
      this.agentInteractions.push({
        fromAgentId: result.action.agentId,
        toAgentId: result.action.target,
        timestamp: new Date(),
        sessionId: result.sessionId,
        chainDepth: this.agentInteractions.filter(
          i => i.sessionId === result.sessionId
        ).length + 1
      });
    }
  }

  /**
   * Verify approval signature (simplified)
   */
  private verifySignature(approval: HumanApproval): boolean {
    // In a real implementation, this would verify a cryptographic signature
    return approval.signature && approval.signature.length > 0;
  }

  /**
   * Create an HSP result object
   */
  private createResult(
    action: AgentAction,
    sessionId: string,
    params: {
      criticalityLevel: CriticalityLevel;
      requiresApproval: boolean;
      status: ActionStatus;
      classificationReason: string;
    }
  ): HSPResult {
    return {
      action,
      sessionId,
      processedAt: new Date(),
      ...params
    };
  }

  /**
   * Add an entry to the audit log
   */
  private addAuditEntry(params: Omit<AuditEntry, 'id' | 'timestamp' | 'hash' | 'previousHash'>): void {
    const previousEntry = this.auditLog[this.auditLog.length - 1];
    const timestamp = new Date();
    
    const entry: AuditEntry = {
      id: randomUUID(),
      timestamp,
      previousHash: previousEntry?.hash,
      hash: '', // Will be set below
      ...params
    };

    // Calculate hash for integrity
    entry.hash = this.calculateHash(entry);
    
    this.auditLog.push(entry);
  }

  /**
   * Calculate hash for audit entry
   */
  private calculateHash(entry: Omit<AuditEntry, 'hash'>): string {
    const data = JSON.stringify({
      id: entry.id,
      sessionId: entry.sessionId,
      eventType: entry.eventType,
      timestamp: entry.timestamp.toISOString(),
      actorId: entry.actorId,
      details: entry.details,
      previousHash: entry.previousHash
    });
    
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get the audit log
   */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }

  /**
   * Verify audit log integrity
   */
  verifyAuditIntegrity(): boolean {
    for (let i = 1; i < this.auditLog.length; i++) {
      const entry = this.auditLog[i];
      const previousEntry = this.auditLog[i - 1];
      
      if (entry.previousHash !== previousEntry.hash) {
        return false;
      }
    }
    return true;
  }
}

export default HSPEngine;
