# Human Supervision Protocol (HSP)

The Human Supervision Protocol is the safety and governance layer of PSAN, ensuring that AI agent autonomy never exceeds human authorization.

## Overview

As AI agents become increasingly autonomous, the question of control becomes paramount. HSP provides a standardized framework for:

1. **Mandatory Human Checkpoints** — Critical decisions require explicit human approval
2. **Anti-Loop Protection** — Limits on agent-to-agent interactions prevent runaway cascades
3. **Cascade Failure Detection** — Automatic detection and prevention of systemic failures
4. **Criticality Classification** — LOW, MEDIUM, HIGH, CRITICAL levels determine approval requirements
5. **Immutable Audit Trail** — Every decision, approval, and action is permanently recorded

## Core Components

### Criticality Levels

| Level | Threshold Example | Approval Required |
|-------|-------------------|-------------------|
| LOW | Information queries | None (auto-approve) |
| MEDIUM | Routine transactions | Async notification |
| HIGH | Significant decisions | Human confirmation |
| CRITICAL | Major actions | Multi-factor approval |

### Decision Flow

```
Agent Action Request
        │
        ▼
┌───────────────────┐
│ Classify Action   │
│ (Criticality)     │
└────────┬──────────┘
         │
    ┌────┴────┬────────────┬──────────────┐
    ▼         ▼            ▼              ▼
  LOW      MEDIUM        HIGH         CRITICAL
    │         │            │              │
    ▼         ▼            ▼              ▼
 Execute   Execute +    Request      Multi-factor
           Notify      Approval       Approval
                          │              │
                          ▼              ▼
                    ┌─────────────────────┐
                    │   Human Decision    │
                    │  Approve / Reject   │
                    └──────────┬──────────┘
                               │
                          ┌────┴────┐
                          ▼         ▼
                      Execute    Abort
```

## Implementation

See the reference implementation in this directory:

- `types.ts` — Core type definitions
- `hsp-engine.ts` — Main HSP processing engine
- `classifiers/` — Criticality classification modules
- `audit/` — Audit trail implementation

## EU AI Act Compliance

HSP is designed to comply with EU AI Act Article 14 (Human Oversight) requirements:

- Human ability to understand AI system capacities and limitations
- Human ability to monitor operation and detect anomalies
- Human ability to interpret outputs correctly
- Human ability to decide not to use the system
- Human ability to intervene or interrupt the system

## Usage

```typescript
import { HSPEngine, CriticalityLevel } from '@psan/hsp';

const hsp = new HSPEngine({
  defaultLevel: CriticalityLevel.MEDIUM,
  escalationRules: [
    { condition: (action) => action.value > 1000, level: CriticalityLevel.HIGH },
    { condition: (action) => action.value > 10000, level: CriticalityLevel.CRITICAL }
  ]
});

// Process an agent action
const result = await hsp.process({
  agentId: 'financial-agent-001',
  action: 'transfer',
  value: 5000,
  target: 'vendor-account'
});

if (result.requiresApproval) {
  // Request human approval
  const approval = await requestHumanApproval(result);
  await hsp.executeWithApproval(result, approval);
}
```

## License

MIT License — See [LICENSE-MIT](../LICENSE-MIT)
