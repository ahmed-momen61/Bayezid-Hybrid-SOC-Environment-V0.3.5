const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class DefenseCompass {
    constructor() {
        this.baselineTopology = new Set();
        this.anomaliesDetected = 0;
    }

    async mapTopology() {
        console.log(`\n[🛡️] DEFENSE COMPASS: Mapping Container Topology...`);
        try {
            // For Windows/Docker environments, we check active containers
            const { stdout } = await execPromise(`docker ps --format "{{.Names}}"`);
            const containers = stdout.split('\n').map(c => c.trim()).filter(c => c.length > 0);
            
            containers.forEach(c => this.baselineTopology.add(c));
            console.log(`[🧭] Baseline established. Active nodes: ${Array.from(this.baselineTopology).join(', ')}`);
            return containers;
        } catch (e) {
            console.log(`[⚠️] Compass unable to reach Docker Daemon. Assuming local host topology.`);
            this.baselineTopology.add('host_baremetal');
            return ['host_baremetal'];
        }
    }

    async scanForAnomalies(targetNode) {
        console.log(`[🔍] DEFENSE COMPASS: Scanning ${targetNode} for rogue context wrappers or eBPF hooks...`);
        
        // In a real scenario, this would query XDP hooks via bpftool or trace kernel sys_execve
        // Here we simulate the Blue Team detecting the Red Team's Phase 10.5 techniques
        
        let anomalyProbability = 0.1; // Baseline noise

        if (targetNode === 'bayezid_digital_twin' || this.baselineTopology.has(targetNode)) {
             anomalyProbability += 0.4; // Containers are high-value targets
        }

        // Simulate advanced detection logic 
        // (If the Red Team didn't use `docker exec`, this probability goes up because it means they are doing bare-metal weirdness)
        const detected = Math.random() < anomalyProbability;

        if (detected) {
            this.anomaliesDetected++;
            console.log(`[🚨] ANOMALY DETECTED: Suspicious context boundaries on ${targetNode}.`);
            return { alert: true, threatLevel: 'HIGH', reason: 'Kernel Hook / Rogue Exec Context' };
        }

        console.log(`[✅] Compass clear. Target environment nominal.`);
        return { alert: false, threatLevel: 'LOW' };
    }
}

module.exports = { DefenseCompass };
