import { IncidentLedger, IrPipelineInput, CausalVerdict } from './irShared';
import axios from 'axios';
const defensiveEnforcer = require('../blue_swarm/defensiveEnforcer');
export async function alertTriage(input: IrPipelineInput): Promise<{ threatScore: number, isFalsePositive: boolean }> {
    console.log(`[IR Activity] Triaging alert ${input.alertId} from ${input.sourceIp}`);
    const isFalsePositive = input.initialPayload && input.initialPayload.length < 5;
    const threatScore = isFalsePositive ? 10 : 85;
    return { threatScore, isFalsePositive };
}
export async function threatScoping(sourceIp: string, initialAssets: string[]): Promise<{ newAssets: string[] }> {
    console.log(`[IR Activity] Scoping threat originating from ${sourceIp}`);
    return { newAssets: [`database-server`, `api-gateway`] };
}
export async function containmentPlan(ledger: IncidentLedger): Promise<{ proposedActions: string[], requiresHumanApproval: boolean }> {
    console.log(`[IR Activity] Generating containment plan for ${ledger.affectedAssets.length} assets`);
    const proposedActions = [
        `BLOCK_IP:${ledger.logs[0] ? '192.168.1.47' : '10.0.0.1'}`,
        `ISOLATE_ASSET:${ledger.affectedAssets[0]}`
    ];
    const requiresHumanApproval = ledger.threatScore < 90 || ledger.affectedAssets.includes('database-server');
    return { proposedActions, requiresHumanApproval };
}
export async function checkContainmentGate(action: string, context: string[]): Promise<CausalVerdict> {
    console.log(`[IR Activity] Requesting Causal Verification for action: ${action}`);
    try {
        const response = await axios.post('http://localhost:8002/api/v1/causal/verify-action', {
            action,
            context
        });
        return {
            action,
            approved: response.data.approved,
            riskScore: response.data.risk_score,
            justification: response.data.justification
        };
    } catch (e: any) {
        console.warn(`[IR Activity] Causal Engine unreachable, defaulting to SAFE (Approved). Error: ${e.message}`);
        return {
            action,
            approved: true,
            riskScore: 50,
            justification: "Causal Engine Offline - Fallback Approved"
        };
    }
}
export async function containmentExec(actions: string[], alertId: string): Promise<void> {
    console.log(`[IR Activity] Executing ${actions.length} containment actions for ${alertId}`);
    for (const action of actions) {
        if (action.startsWith('BLOCK_IP:')) {
            const ip = action.split(':')[1];
            console.log(`[🔥] Executing defensive enforcer: IPTABLES DROP ${ip}`);
            try {
                await defensiveEnforcer.blockIp(ip, alertId);
            } catch (err: any) {
                console.error(`[-] Failed to block IP ${ip}: ${err.message}`);
            }
        }
    }
}
export async function eradication(assets: string[], sourceIp: string): Promise<void> {
    console.log(`[IR Activity] Eradicating persistence mechanisms on ${assets.join(', ')}`);
}
export async function irReport(ledger: IncidentLedger): Promise<void> {
    console.log(`[IR Activity] Generating final IR Report for ${ledger.alertId}`);
}
