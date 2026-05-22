const { HeuristicWatchdog } = require('./heuristicWatchdog');

class EpistemicEngine {
    constructor() {
        this.confidenceThreshold = 0.85; // 85% requirement to act aggressively
        this.dropoutRate = 0.20; // 20% Bayesian Dropout
        this.watchdog = new HeuristicWatchdog();
    }

    /**
     * Simulates Bayesian Monte Carlo Dropout.
     * By randomly dropping connections, we test if the network's confidence is fragile.
     * @param {number} baseConfidence The initial confidence of the neural prediction.
     * @returns {number} The jittered confidence after dropout.
     */
    applyMonteCarloDropout(baseConfidence) {
        // If the model is truly certain, dropout won't drop confidence much.
        // If it's hallucinating, dropout will cause massive variance.
        
        // Simulating the variance drop based on random chance
        let droppedNodes = 0;
        for (let i = 0; i < 10; i++) {
            if (Math.random() < this.dropoutRate) droppedNodes++;
        }

        // Penalty scales with how many simulated critical nodes were dropped
        const dropoutPenalty = droppedNodes * 0.05 * Math.random();
        
        return Math.max(0, baseConfidence - dropoutPenalty);
    }

    /**
     * Evaluates whether an agent should proceed or doubt its own action.
     * @param {Object} proposedAction The action the MARL wants to take
     * @param {number} rawConfidence The raw neural confidence (0.0 to 1.0)
     * @param {Object} state The environment state to pull heuristics from
     */
    evaluateDoubtProtocol(proposedAction, rawConfidence, state) {
        // 1. Apply Bayesian Dropout
        const calibratedConfidence = this.applyMonteCarloDropout(rawConfidence);
        let finalActionType = proposedAction.type;
        let doubtTriggered = false;

        // Phase 15: Heuristic Watchdog as Ultimate Arbiter
        let isHeuristicBreach = false;
        if (state) {
            const metrics = this.watchdog.getSystemMetrics(state);
            isHeuristicBreach = this.watchdog.evaluateBehavioralBreach(metrics);
        }

        // 2. Hunter-Killer Escalation Ladder Check (Phase 16)
        if (proposedAction.type === 'ISOLATE_NODE' || proposedAction.type === 'DEPLOY_HONEY_TOKENS' || proposedAction.type === 'ACTIVE_NEUTRALIZATION') {
            
            // Ultimate Arbiter Logic: Even if confidence is high, if heuristics are clean in high entropy, abort isolation
            if (calibratedConfidence >= 0.95 && state && state.highEntropy && !isHeuristicBreach) {
                console.log(`\n[🐺] WATCHDOG ARBITER: Vetoing high-confidence isolation. Heuristics are quiet.`);
                finalActionType = 'DECEPTIVE_PROBE';
                doubtTriggered = true;
            } else if (calibratedConfidence < 0.40) {
                // If heuristics spike but confidence is low, escalate to throttle instead of passive observation
                if (isHeuristicBreach) {
                    console.log(`\n[🐺] WATCHDOG ARBITER: Confidence is low, but Heuristics spiked! Forcing Escalation.`);
                    finalActionType = 'ESCALATE_RESPONSE';
                    doubtTriggered = true;
                } else {
                    console.log(`\n[🤔] EPISTEMIC DOUBT: Confidence (${(calibratedConfidence * 100).toFixed(1)}%) < 40%. Level 1.`);
                    console.log(`    Action overridden to [PASSIVE_OBSERVATION].`);
                    finalActionType = 'OBSERVE';
                    doubtTriggered = true;
                }
            } else if (calibratedConfidence >= 0.40 && calibratedConfidence <= 0.65) {
                console.log(`\n[🎣] DECEPTIVE PROBE: Confidence (${(calibratedConfidence * 100).toFixed(1)}%) in target window. Level 2.`);
                console.log(`    Action overridden to [DECEPTIVE_PROBE]. Initiating fake request.`);
                finalActionType = 'DECEPTIVE_PROBE';
                doubtTriggered = true;
            } else if (calibratedConfidence > 0.65 && calibratedConfidence <= 0.80) {
                console.log(`\n[🚧] CALIBRATED AGGRESSION: Confidence (${(calibratedConfidence * 100).toFixed(1)}%) in target window. Level 3.`);
                console.log(`    Action overridden to [ESCALATE_RESPONSE] / [COUNTER_FLOOD]. Throttling and hunting.`);
                finalActionType = 'ESCALATE_RESPONSE'; // Simulation will branch to COUNTER_FLOOD if hunter succeeds
                doubtTriggered = true;
            } else if (calibratedConfidence > 0.80 && calibratedConfidence < 0.95) {
                console.log(`\n[⚔️] THE HUNTER-KILLER: Confidence (${(calibratedConfidence * 100).toFixed(1)}%) in target window. Level 4.`);
                console.log(`    Action overridden to [ACTIVE_NEUTRALIZATION]. Executing surgical strike.`);
                finalActionType = 'ACTIVE_NEUTRALIZATION';
                doubtTriggered = true;
            } else if (calibratedConfidence >= 0.95) {
                // Full Isolate (Level 5)
                finalActionType = 'ISOLATE_NODE';
            }
        }

        return {
            approvedAction: { type: finalActionType, agent: proposedAction.agent },
            calibratedConfidence: calibratedConfidence,
            doubtTriggered: doubtTriggered
        };
    }
}

module.exports = { EpistemicEngine };
