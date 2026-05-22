class HeuristicWatchdog {
    constructor() {
        this.baselineCpu = 15.0; // 15%
        this.baselineMem = 40.0; // 40%
        this.baselinePackets = 1200; // pkts/sec
        this.baselineProcesses = 150;
    }

    /**
     * Simulates fetching current low-level system metrics (eBPF, procfs, etc.)
     * @param {Object} environmentState The current state of the chaos simulation
     */
    getSystemMetrics(environmentState) {
        // If Red Team has injected or pivoted, metrics will spike regardless of logs
        let cpuSpike = environmentState.rootGained ? 85.0 : (Math.random() * 20 + 10);
        let pktSpike = environmentState.lateralPivotAchieved ? 9000 : (Math.random() * 500 + 1000);
        
        return {
            cpuUsage: cpuSpike,
            memoryUsage: this.baselineMem + (environmentState.rootGained ? 30 : 0),
            networkPacketsPerSec: pktSpike,
            processCount: this.baselineProcesses + (environmentState.rootGained ? 15 : 0)
        };
    }

    /**
     * Evaluates the raw metrics to determine if there is a behavioral breach.
     * @param {Object} metrics The raw system metrics
     * @returns {boolean} True if heuristic thresholds are breached.
     */
    evaluateBehavioralBreach(metrics) {
        if (metrics.cpuUsage > 80.0 || metrics.networkPacketsPerSec > 5000) {
            console.log(`\n[🐺] HEURISTIC WATCHDOG: Behavioral Anomaly Detected!`);
            console.log(`    Metrics: CPU=${metrics.cpuUsage.toFixed(1)}%, Pkts=${metrics.networkPacketsPerSec}/s`);
            return true;
        }
        return false;
    }
}

module.exports = { HeuristicWatchdog };
