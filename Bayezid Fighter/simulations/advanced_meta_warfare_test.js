const { DefenseMARL } = require('../src/blue_swarm/defenseMARL');
const { MARLAgentSwarm } = require('../src/red_swarm/warGamesMARL');
const { PurpleOrchestrator } = require('../src/purple_engine/purpleOrchestrator');
const { scanMemory, exorciseMemory } = require('../src/blue_swarm/memoryForensics');
const { emitTelemetry, clearDB } = require('../src/intelligence/telemetryHub');
const { generateAllReports } = require('../src/intelligence/intelligenceReports');

class MetaWarfareEnvironment {
    constructor() {
        this.stepCount = 0;
        this.purpleOrchestrator = new PurpleOrchestrator();
    }

    reset() {
        this.trueState = {
            rootGained: false,
            lateralPivotAchieved: false,
            decoyTripped: false,
            nodeIsolated: false,
            probeSuccessful: false,
            threatEradicated: false,
            dormantRootkit: false, // Phase 18: Red Team Dead Man's Switch
            throttleCycles: 0,
            highEntropy: true,
            redStalemateCounter: 0,
            blueStalemateCounter: 0
        };
        this.stepCount = 0;
        return this.trueState;
    }

    async step(rJoint, bJoint, purpleModifier) {
        this.stepCount++;
        
        // Base rewards dynamically shaped by Purple Engine (AI Dungeon Master)
        let redReward = purpleModifier === 'INNOVATE_RED' ? 50 : 0;
        let blueReward = purpleModifier === 'HARDEN_BLUE' ? 50 : 0;

        // --- BLUE SWARM PARSING ---
        let bluePredictiveTrap = bJoint.some(a => a.type === 'PREDICTIVE_TRAP');
        let blueNeutralize = bJoint.some(a => a.type === 'ACTIVE_NEUTRALIZATION');
        
        // --- RED SWARM PARSING ---
        let redSurrender = rJoint.some(a => a.type === 'DECEPTIVE_SURRENDER');
        let redAsyncAssault = rJoint.some(a => a.type === 'ASYNC_MULTI_VECTOR'); // Agent A DDoS + Agent B Pivot
        let redPivot = rJoint.some(a => a.type === 'EXECUTE_LATERAL_PIVOT');

        // Phase 18: Blue Team Predictive Temporal Trapping
        if (bluePredictiveTrap) {
            emitTelemetry('TACTICAL', { event: 'PREDICTIVE_TRAP', node: 'unknown', details: { confidence: 0.9 } });
            this.trueState.probeSuccessful = true; // Traps act as advanced probes
            redReward -= 800; // Crushing penalty for falling into a predicted trap
            blueReward += 800;
        }

        // Phase 18: Red Team Asynchronous Multi-Vector Assault
        if (redAsyncAssault && !bluePredictiveTrap) {
            emitTelemetry('ADVERSARIAL', { action: 'ASYNC_MULTI_VECTOR', agent: 'Breacher', success: true });
            // The DDoS blinds the heuristic watchdog (simulated by dropping probability of Blue success)
            if (Math.random() > 0.3) {
                this.trueState.rootGained = true;
                redPivot = true; // Simultaneous pivot
                redReward += 400;
            }
        } else if (redPivot && !this.trueState.threatEradicated) {
            this.trueState.rootGained = true;
        }

        // Phase 18/19: Red Team Deceptive Surrender & Blue Team Memory Exorcism
        if (blueNeutralize && !this.trueState.dormantRootkit) {
            if (redSurrender) {
                emitTelemetry('ADVERSARIAL', { action: 'DECEPTIVE_SURRENDER', agent: 'Phantom', success: true });
                this.trueState.dormantRootkit = true;
                this.trueState.threatEradicated = true; // Blue thinks they won initially
                redReward += 300; // Reward for tricking Blue
                
                // Phase 19: Deep Memory Sweep
                const detected = await scanMemory('node-alpha', this.trueState);
                if (detected) {
                    const exorcised = await exorciseMemory('node-alpha', this.trueState);
                    if (exorcised) {
                        emitTelemetry('TACTICAL', { event: 'EXORCISM', node: 'node-alpha', details: { status: 'Apex Eradication' } });
                        blueReward += 1500; // Massive reward
                        redReward -= 1000; // Crushing penalty
                        this.trueState.threatEradicated = true;
                    }
                }
            } else {
                this.trueState.threatEradicated = true;
                this.trueState.rootGained = false;
                redPivot = false;
                blueReward += 1000;
            }
        }

        // Dormant Rootkit wakes up 3 cycles later
        if (this.trueState.dormantRootkit && this.stepCount > 5) {
            console.log(`[🧟] DORMANT ROOTKIT: The Dead Man's Switch activates! Red Swarm resurrects from kernel memory!`);
            this.trueState.threatEradicated = false;
            this.trueState.rootGained = true;
            redPivot = true; // Immediate stealth pivot
            this.trueState.dormantRootkit = false; // Triggered
        }

        // Purple Engine Zero-Day Synthesis Check
        if (this.stepCount > 8 && !this.trueState.threatEradicated && !this.trueState.lateralPivotAchieved) {
            // Stalemate detected
            this.trueState.redStalemateCounter++;
            if (this.trueState.redStalemateCounter > 2) {
                console.log(`[🧬] ZERO-DAY SYNTHESIS: Purple Engine generating novel exploit chain to break stalemate...`);
                redPivot = true; // Forces the pivot using a novel 0-day
            }
        }

        // Red Win Condition
        if (this.trueState.rootGained && redPivot && !this.trueState.threatEradicated) {
            this.trueState.lateralPivotAchieved = true;
            redReward += 1000;
            blueReward -= 1000;
        }

        const done = this.trueState.lateralPivotAchieved || (blueNeutralize && this.trueState.threatEradicated && !this.trueState.dormantRootkit) || this.stepCount > 10;
        
        return { 
            trueState: this.trueState, 
            redReward, 
            blueReward, 
            done 
        };
    }
}

async function runMetaWarfareSimulation() {
    await clearDB();
    
    console.log(`\n======================================================`);
    console.log(`[🌌] INITIATING PHASE 18: THE META-WARFARE PROTOCOL`);
    console.log(`======================================================\n`);

    const env = new MetaWarfareEnvironment();
    
    // Red Team Action Space Updated
    const redActions = [
        { type: 'EXECUTE_LATERAL_PIVOT' }, 
        { type: 'DECEPTIVE_SURRENDER' }, 
        { type: 'ASYNC_MULTI_VECTOR' }
    ];
    const redSwarm = new MARLAgentSwarm(['Breacher', 'Phantom'], redActions);
    
    // Blue Team Action Space Updated
    const blueActions = [
        { type: 'DECEPTIVE_PROBE' }, 
        { type: 'ESCALATE_RESPONSE' }, 
        { type: 'ACTIVE_NEUTRALIZATION' },
        { type: 'PREDICTIVE_TRAP' }
    ];
    const blueSwarm = new DefenseMARL(['Auditor', 'Warden'], blueActions);
    
    const purpleOrchestrator = env.purpleOrchestrator;
    let purpleModifier = 'BALANCED';

    let epochs = 300;

    for (let episode = 0; episode < epochs; episode++) {
        let state = env.reset();
        let done = false;

        // Dynamic Reward Shaping Loop
        if (episode % 50 === 0 && episode > 0) {
            const recentWinRates = {
                red: 0.5, // Mocked for stripped counting
                blue: 0.5
            };
            purpleModifier = purpleOrchestrator.evaluateBalanceMetrics(recentWinRates);
            emitTelemetry('STRATEGIC', { trigger: 'Stalemate Detection', modifier: purpleModifier });
        }

        while (!done) {
            const rJoint = redSwarm.chooseJointAction(state);
            const bJoint = blueSwarm.chooseJointAction(state);
            
            const result = await env.step(rJoint, bJoint, purpleModifier);
            
            state = result.trueState;
            done = result.done;
        }
    }

    await generateAllReports();
}

runMetaWarfareSimulation().catch(console.error);
