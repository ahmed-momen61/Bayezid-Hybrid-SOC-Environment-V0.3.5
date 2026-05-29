export interface IncidentLedger {
    alertId: string;
    status: 'OPEN' | 'CONTAINED' | 'ERADICATED' | 'CLOSED';
    threatScore: number;
    affectedAssets: string[];
    containmentActions: string[];
    causalVerdicts: CausalVerdict[];
    logs: string[];
}
export interface IrPipelineInput {
    alertId: string;
    initialPayload: any;
    sourceIp: string;
    targetAsset: string;
}
export interface CausalVerdict {
    action: string;
    approved: boolean;
    riskScore: number;
    justification: string;
}
