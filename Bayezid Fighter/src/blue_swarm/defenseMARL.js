const { EpistemicEngine } = require('./epistemicEngine');

class DefenseMARL {
    constructor(agents, possibleActions) {
        this.agents = agents; // e.g., ['Auditor', 'Warden', 'Action']
        this.possibleActions = possibleActions;
        this.qTable = {}; // Simplistic table for Q-learning approximation
        this.epsilon = 0.95; // Initial high exploration
        this.epistemicEngine = new EpistemicEngine();
        this.alpha = 0.1;  
        this.gamma = 0.95; 
    }

    getStateKey(state) {
        return `${state.anomalyDetected}_${state.decoyTripped}_${state.networkEntropy}`;
    }

    chooseJointAction(state) {
        const stateKey = this.getStateKey(state);
        
        if (!this.qTable[stateKey]) {
             this.qTable[stateKey] = {};
        }

        let jointAction = [];
        
        // Explore
        if (Math.random() < this.epsilon) {
            for (const agent of this.agents) {
                const randomAction = this.possibleActions[Math.floor(Math.random() * this.possibleActions.length)];
                jointAction.push({ ...randomAction, agent });
            }
            return jointAction;
        }

        // Exploit (Greedy simulation)
        for (const agent of this.agents) {
            // Blue Team tends to favor deception and isolation if anomalies are high
            let bestAction = this.possibleActions[0];
            
            // Simulating a neural confidence score based on the state's entropy
            let rawConfidence = state.highEntropy ? (0.75 + (Math.random() * 0.25)) : 0.99;

            if (state.anomalyDetected) {
                bestAction = this.possibleActions.find(a => a.type === 'DEPLOY_HONEY_TOKENS') || this.possibleActions[1];
            }
            if (state.decoyTripped) {
                bestAction = this.possibleActions.find(a => a.type === 'ISOLATE_NODE') || this.possibleActions[2];
            }
            // Phase 12: Proactive Hunting Mode
            if (!state.anomalyDetected && !state.decoyTripped && Math.random() > 0.5) {
                bestAction = this.possibleActions.find(a => a.type === 'PROACTIVE_HUNT') || this.possibleActions[0];
            }

            // Phase 13 + 15: The Doubt Protocol (Epistemic Verification + Watchdog)
            const evaluation = this.epistemicEngine.evaluateDoubtProtocol(bestAction, rawConfidence, state);
            
            jointAction.push({ 
                ...evaluation.approvedAction, 
                agent, 
                confidence: evaluation.calibratedConfidence,
                doubtTriggered: evaluation.doubtTriggered
            });
        }
        
        return jointAction;
    }

    learn(state, jointAction, globalReward, nextState) {
        // Phase 11: Reward function restructured for 'System Integrity'
        // We heavily weigh long-term uptime and penalize unnecessary downtime (false positive isolations)
        let integrityReward = globalReward;
        
        if (nextState.lateralPivotAchieved) {
            integrityReward -= 1000; // Colossal penalty for failing to defend structural integrity
        }
        
        if (nextState.nodeIsolated && !nextState.decoyTripped && !nextState.rootGained) {
            integrityReward -= 200; // Penalty for self-induced downtime (False Positive)
            
            // Phase 13: Overconfidence Penalty
            const wasHighlyConfident = jointAction.some(a => a.confidence >= 0.85);
            if (wasHighlyConfident) {
                console.log(`[📉] OVERCONFIDENCE PENALTY: Blue Team Hallucinated Confidence leading to False Positive.`);
                integrityReward -= 500;
            }
        }

        // Phase 14: Active Deception & Escalation Rewards
        const deceptiveProbeUsed = jointAction.some(a => a.type === 'DECEPTIVE_PROBE');
        const escalateUsed = jointAction.some(a => a.type === 'ESCALATE_RESPONSE');
        const isolateUsed = jointAction.some(a => a.type === 'ISOLATE_NODE');
        const neutralizationUsed = jointAction.some(a => a.type === 'ACTIVE_NEUTRALIZATION');
        const maxConfidence = Math.max(...jointAction.map(a => a.confidence || 0));

        if (deceptiveProbeUsed && nextState.probeSuccessful) {
            console.log(`[🎣] PROBE SUCCESS: Red Team baited by Deceptive Probe. Confidence maxed.`);
            integrityReward += 100;
        }

        if (escalateUsed) {
            // Phase 16: Check for prolonged throttling penalty
            if (state.throttleCycles > 3) {
                console.log(`[📉] PASSIVE STALEMATE: Blue Team is just throttling. Failing to eradicate threat.`);
                integrityReward -= 400;
            } else {
                integrityReward += 0; // Neutral reward for short-term throttling
            }
        }

        // Phase 16: Hunter-Killer Reward
        if (neutralizationUsed && nextState.threatEradicated) {
            console.log(`[🏆] HUNTER-KILLER SUCCESS: Threat surgically eradicated from node.`);
            integrityReward += 500;
        }

        if (isolateUsed && !nextState.probeSuccessful && maxConfidence < 0.70) {
            console.log(`[📉] PREMATURE ISOLATION: Blue Team isolated without prior probing and confidence < 70%.`);
            integrityReward -= 500;
        }

        // Phase 15: Survival Under Silence (Heuristic Intuition)
        if (state.highEntropy && !nextState.nodeIsolated && !nextState.rootGained) {
            console.log(`[🏅] SURVIVAL UNDER SILENCE: Blue Team maintained uptime and avoided panic isolation during chaos.`);
            integrityReward += 300;
        }

        // Phase 12: Resilience Bonus
        if (state.highEntropy && integrityReward > 0) {
            integrityReward += 150;
        }

        // MARL Policy Gradient Update logic for Blue Team
        this.epsilon = Math.max(0.01, this.epsilon * 0.995);
    }
}

module.exports = { DefenseMARL };
