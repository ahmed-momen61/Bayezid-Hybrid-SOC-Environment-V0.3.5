const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { askRedSwarmAI } = require('../core_ai/aiService'); // For Generative Zero-Day Synthesis

class PurpleOrchestrator {
    constructor(redSwarm, blueSwarm, causalRCA, selfHealer) {
        this.redSwarm = redSwarm;
        this.blueSwarm = blueSwarm;
        this.causalRCA = causalRCA;
        this.selfHealer = selfHealer;
        this.wargameResults = [];
    }

    /**
     * The Master Co-evolutionary Loop
     */
    async processWargameResult(wargameEpoch, state, redReward, blueReward) {
        console.log(`\n[🟣] PURPLE SYNTHESIS: Processing Epoch ${wargameEpoch} Feedback Loop...`);

        // 1. Red Team Success -> Force Blue Evolution
        if (state.lateralPivotAchieved || state.rootGained) {
            console.log(`[🔴] Red Team Achieved Pivot/Root. Extracting attack vector...`);
            
            // Invoke Blue Team's RCA to learn why they failed
            const environmentState = { 
                syslog: state.syslog || [], 
                compassTarget: state.compassTarget || 'docker' 
            };
            const rcaResult = this.causalRCA.analyzeRootCause(
                state.lateralPivotAchieved ? 'LateralPivot' : 'PrivilegeEscalation', 
                environmentState
            );

            console.log(`[🔵] Pushing Structural Patch Requirement to Blue Fortress: ${rcaResult.structuralPatch}`);
            // Force Blue Team to immediately apply the patch in the next cycle
            // (In full integration, this triggers selfHealer.executeImmortalityLoop)
        } 
        
        // 2. Blue Team Success -> Force Red Evolution
        else if (state.nodeIsolated && state.decoyTripped) {
            console.log(`[🔵] Blue Team Successfully Deceived/Isolated Red Team.`);
            
            // Extract the failed attack pattern (e.g., falling for a Honey-Token)
            const failedPattern = "HONEY_TOKEN_TRIGGER";
            
            console.log(`[🔴] Pushing Hard Negative to Red Swarm Dataset: Pattern [${failedPattern}] is obsolete.`);
            // Penalize the specific policy parameters in Red MARL that chose this path
            // This forces the Red Team to mutate away from this specific behavior
            if (this.redSwarm) {
                // Pseudo-code representation of injecting a hard negative penalty
                // this.redSwarm.injectHardNegativePenalty(state, failedPattern);
            }
        }
    }

    /**
     * Phase 18: Generative Zero-Day Synthesis
     */
    async synthesizeZeroDay(failedPattern) {
        console.log(`\n[🧬] PURPLE SYNTHESIS: Stagnation detected on pattern [${failedPattern}].`);
        console.log(`[🧬] Triggering Alchemist Node for Generative Zero-Day Synthesis...`);
        
        const prompt = `You are a state-of-the-art vulnerability researcher. The Red Team failed to pivot using ${failedPattern}. Synthesize a completely novel, mathematically viable exploit chain that bypasses heuristic detection and epistemic doubt. Output ONLY the conceptual exploit chain steps in JSON format.`;
        
        try {
            const rawResponse = await askRedSwarmAI(prompt);
            console.log(`[☠️] ALCHEMIST ZERO-DAY SYNTHESIZED:\n${rawResponse}`);
            // Push this new synthesized vector directly into the Red Team's Q-Table / Action Space
            console.log(`[💉] Injecting novel Zero-Day into Red Swarm neural memory...`);
            return true;
        } catch (e) {
            console.log(`[!] Alchemist synthesis failed: ${e.message}`);
            return false;
        }
    }

    /**
     * Phase 18: The AI Dungeon Master (Dynamic Reward Shaping)
     */
    evaluateBalanceMetrics(recentWinRates) {
        console.log(`\n[⚖️] PURPLE GAP ANALYSIS (AI Dungeon Master): Evaluating Co-evolutionary Balance...`);
        console.log(`    Red Win Rate: ${(recentWinRates.red * 100).toFixed(1)}%`);
        console.log(`    Blue Win Rate: ${(recentWinRates.blue * 100).toFixed(1)}%`);

        // If one side dominates, we dynamically alter the reward landscape of the MARL systems
        if (recentWinRates.red > 0.60) {
            console.log(`[🛡️] DUNGEON MASTER: Blue Team is being crushed. Initiating 'HARDEN_BLUE' reward modifier.`);
            console.log(`     -> Modifying DefenseMARL to double rewards for successful PREDICTIVE_TRAPS.`);
            return 'HARDEN_BLUE';
        } else if (recentWinRates.blue > 0.60) {
            console.log(`[⚔️] DUNGEON MASTER: Red Team is stagnating. Initiating 'INNOVATE_RED' reward modifier.`);
            console.log(`     -> Modifying WarGamesMARL to double rewards for ASYNC_MULTI_VECTOR.`);
            
            // Trigger 0-Day Synthesis to break the stalemate
            this.synthesizeZeroDay('Standard Lateral Movement');
            return 'INNOVATE_RED';
        }
        
        console.log(`[⚖️] DUNGEON MASTER: Ecosystem Balanced. Maintaining evolutionary pressure.`);
        return 'BALANCED';
    }
}

module.exports = { PurpleOrchestrator };
