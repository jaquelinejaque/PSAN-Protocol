import { HSPEngine } from './hsp-engine';
import { CriticalityLevel, ActionStatus, AgentAction } from './types';

describe('HSPEngine', () => {
    let engine: HSPEngine;

    beforeEach(() => {
        engine = new HSPEngine({
            defaultLevel: CriticalityLevel.MEDIUM,
            escalationRules: [
                {
                    condition: (action) => (action.value ?? 0) > 1000,
                    level: CriticalityLevel.HIGH,
                    reason: 'Value exceeds 1000'
                },
                {
                    condition: (action) => (action.value ?? 0) > 10000,
                    level: CriticalityLevel.CRITICAL,
                    reason: 'Value exceeds 10000'
                }
            ]
        });
    });

    describe('process', () => {
        it('should auto-approve LOW criticality actions', async () => {
            const action: AgentAction = {
                id: 'test-1',
                agentId: 'agent-001',
                type: 'query',
                description: 'Query user preferences',
                requestedAt: new Date()
            };

            const result = await engine.process(action);

            expect(result.criticalityLevel).toBe(CriticalityLevel.LOW);
            expect(result.requiresApproval).toBe(false);
            expect(result.status).toBe(ActionStatus.APPROVED);
        });

        it('should require approval for HIGH criticality actions', async () => {
            const action: AgentAction = {
                id: 'test-2',
                agentId: 'agent-001',
                type: 'purchase',
                description: 'Purchase item',
                value: 500,
                requestedAt: new Date()
            };

            const result = await engine.process(action);

            expect(result.criticalityLevel).toBe(CriticalityLevel.HIGH);
            expect(result.requiresApproval).toBe(true);
            expect(result.status).toBe(ActionStatus.AWAITING_APPROVAL);
        });

        it('should escalate based on value rules', async () => {
            const action: AgentAction = {
                id: 'test-3',
                agentId: 'agent-001',
                type: 'read',
                description: 'High value operation',
                value: 5000,
                requestedAt: new Date()
            };

            const result = await engine.process(action);

            expect(result.criticalityLevel).toBe(CriticalityLevel.HIGH);
            expect(result.classificationReason).toContain('Value exceeds 1000');
        });

        it('should classify CRITICAL actions correctly', async () => {
            const action: AgentAction = {
                id: 'test-4',
                agentId: 'agent-001',
                type: 'transfer',
                description: 'Transfer funds',
                value: 100,
                requestedAt: new Date()
            };

            const result = await engine.process(action);

            expect(result.criticalityLevel).toBe(CriticalityLevel.CRITICAL);
            expect(result.requiresApproval).toBe(true);
        });
    });

    describe('audit log', () => {
        it('should maintain audit log integrity', async () => {
            const action: AgentAction = {
                id: 'test-5',
                agentId: 'agent-001',
                type: 'query',
                description: 'Test action',
                requestedAt: new Date()
            };

            await engine.process(action);

            const auditLog = engine.getAuditLog();
            expect(auditLog.length).toBeGreaterThan(0);
            expect(engine.verifyAuditIntegrity()).toBe(true);
        });
    });
});
