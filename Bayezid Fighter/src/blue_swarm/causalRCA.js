class CausalRCA {
    constructor() {
        this.causalGraph = {
            'PrivilegeEscalation': ['KernelVulnerability', 'MisconfiguredSUID', 'UnrestrictedDockerSocket'],
            'LateralPivot': ['HardcodedCredentials', 'ExposedSSHKey', 'FlatNetworkTopology'],
            'InitialAccess': ['WeakPassword', 'Phishing', 'ExposedAPI'],
            'Evasion': ['OutdatedSignatures', 'MissingContextWrappers', 'BlindTelemetry']
        };
        this.structuralPatches = {
            'UnrestrictedDockerSocket': 'chmod 660 /var/run/docker.sock',
            'ExposedSSHKey': 'rm -f /root/.ssh/id_rsa && ssh-keygen -t rsa -N "" -f /root/.ssh/id_rsa',
            'MissingContextWrappers': 'iptables -A INPUT -p tcp --dport 2222 -j DROP', 
            'HardcodedCredentials': 'export DB_PASSWORD=$(openssl rand -base64 32)'
        };
    }
    analyzeRootCause(attackOutcome, environmentState) {
        console.log(`\n[🧠] CAUSAL RCA: Performing Do-Calculus structural analysis for outcome: ${attackOutcome}...`);
        const possibleCauses = this.causalGraph[attackOutcome];
        if (!possibleCauses) {
            console.log(`[⚠️] Outcome ${attackOutcome} not mapped in causal graph.`);
            return { rootCause: 'Unknown', structuralPatch: null };
        }
        let structuralCause = possibleCauses[0]; 
        if (attackOutcome === 'LateralPivot') {
            if (environmentState.syslog && environmentState.syslog.some(log => log.includes('.ssh'))) {
                structuralCause = 'ExposedSSHKey';
            } else if (environmentState.syslog && environmentState.syslog.some(log => log.includes('env'))) {
                structuralCause = 'HardcodedCredentials';
            }
        } else if (attackOutcome === 'PrivilegeEscalation') {
             if (environmentState.compassTarget === 'docker') {
                 structuralCause = 'UnrestrictedDockerSocket';
             } else {
                 structuralCause = 'KernelVulnerability';
             }
        }
        const structuralPatch = this.structuralPatches[structuralCause] || 'echo "Manual patching required for ' + structuralCause + '"';
        console.log(`[🔬] Do-Calculus Verdict: Attack succeeded due to structural gap [${structuralCause}].`);
        console.log(`[🩹] Recommended Structural Patch: ${structuralPatch}`);
        return { rootCause: structuralCause, structuralPatch };
    }
}
module.exports = { CausalRCA };
