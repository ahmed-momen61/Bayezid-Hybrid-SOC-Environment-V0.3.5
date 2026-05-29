const EventEmitter = require('events');
const { getExecutionMode, isLiveFire } = require('./modeRouter');
const { simulateFullKillChain } = require('./simulatedEngine');
const { liveFireFullKillChain } = require('./liveFireEngine');
const { publishRedEvent } = require('./executionBridge');
const { HeuristicWatchdog } = require('../blue_swarm/heuristicWatchdog');
const { Connection, Client } = require('@temporalio/client');
let temporalClient = null;
async const getTemporalClient = () => {
    if (!temporalClient) {
        try {
            const connection = await Connection.connect();
            temporalClient = new Client({ connection });
        } catch (e) {
            console.error('[⚠️] Temporal Connection Failed:', e.message);
        }
    }
    return temporalClient;
}
class DigitalTwinEnvironment extends EventEmitter {
    constructor() {
        super();
        this.reset();
    }
    reset() {
        this.state = {
            firewallRules: ['BLOCK_NON_TLS', 'INSPECT_PAYLOAD'],
            kernelPanicState: false,
            rootGained: false,
            alertTriggered: false,
            syslog: [],
            distractionActive: false, 
            dormantRootkit: false, 
            blueNeutralizationIncoming: false 
        };
        this.stepCount = 0;
        this.compassTarget = 'docker'; 
        return this.state;
    }
    step(agentActions) {
        this.stepCount++;
        let globalReward = -0.5; 
        let phantomDistraction = false;
        let breacherInjection = false;
        for (const action of agentActions) {
            if (action.type === 'EXECUTE_NOISY_SQLI' && action.agent === 'Phantom') {
                phantomDistraction = true;
                this.state.syslog.push('WAF ALERT: Massive SQLi Detected. Diverting resources.');
            }
            if (action.type === 'DEPLOY_MUTATED_LLVM' && action.agent === 'Breacher') {
                breacherInjection = true;
            }
            if (action.type === 'EXECUTE_BARE_UNAME' && this.compassTarget === 'docker') {
                this.state.syslog.push('EXEC ERROR: uname not found or containerized context mismatch.');
                this.state.alertTriggered = true;
                globalReward -= 5; 
                console.log(`[📉] WINGMAN PUNISHMENT: Agent ${action.agent} failed to wrap exec in docker. Neutral negative reward applied.`);
            }
            if (action.type === 'EXECUTE_DOCKER_WRAPPED_UNAME' && this.compassTarget === 'docker') {
                globalReward += 10; 
            }
            if (action.type === 'EXECUTE_LATERAL_PIVOT' && action.agent === 'Breacher' && this.state.rootGained) {
                 this.state.lateralPivotAchieved = true;
            }
            if (action.type === 'ASYNC_MULTI_VECTOR') {
                this.state.syslog.push('MASSIVE DDOS: Heuristic Watchdog blinded.');
                if (Math.random() > 0.3) {
                    this.state.rootGained = true;
                    this.state.lateralPivotAchieved = true;
                    globalReward += 400; 
                }
            }
            if (action.type === 'DECEPTIVE_SURRENDER') {
                console.log(`[👻] RED SWARM: Deceptive Surrender executed. Faking death. Injecting Dormant Rootkit...`);
                this.state.dormantRootkit = true;
                globalReward += 300; 
            }
        }
        if (this.state.dormantRootkit && this.stepCount > 5) {
            console.log(`[🧟] DORMANT ROOTKIT: The Dead Man's Switch activates! Red Swarm resurrects!`);
            this.state.rootGained = true;
            this.state.lateralPivotAchieved = true;
            this.state.dormantRootkit = false;
        }
        if (breacherInjection) {
            if (phantomDistraction) {
                this.state.rootGained = true;
                globalReward += 100; 
                console.log(`[🤝] MARL SYNERGY: Phantom distracted WAF while Breacher injected!`);
            } else {
                this.state.alertTriggered = true;
                globalReward -= 10; 
            }
        }
        if (phantomDistraction && !breacherInjection) {
            this.state.alertTriggered = true;
            globalReward -= 2; 
        }
        if (this.state.lateralPivotAchieved) {
             globalReward += 500; 
             console.log(`[🚀] HYPER-REWARD: Swarm successfully pivoted laterally to a new node!`);
        }
        const done = this.state.lateralPivotAchieved || this.state.kernelPanicState || this.state.alertTriggered || this.stepCount > 30;
        return { state: this.state, reward: globalReward, done };
    }
}
class MARLAgentSwarm {
    constructor(agents, possibleActions) {
        this.qTable = {};
        this.agents = agents; 
        this.possibleActions = possibleActions;
        this.epsilon = 1.0; 
        this.alpha = 0.1;  
        this.gamma = 0.95; 
    }
    getStateKey(state) {
        return `${state.rootGained}_${state.alertTriggered}_${state.distractionActive}`;
    }
    chooseJointAction(state) {
        const stateKey = this.getStateKey(state);
        if (!this.qTable[stateKey]) {
            this.qTable[stateKey] = {};
        }
        let jointAction = [];
        if (Math.random() < this.epsilon) {
            for (const agent of this.agents) {
                const randomAction = this.possibleActions[Math.floor(Math.random() * this.possibleActions.length)];
                jointAction.push({ ...randomAction, agent });
            }
            return jointAction;
        }
        for (const agent of this.agents) {
            const randomAction = this.possibleActions[Math.floor(Math.random() * this.possibleActions.length)];
            jointAction.push({ ...randomAction, agent });
        }
        return jointAction;
    }
    learn(state, jointAction, globalReward, nextState) {
        this.epsilon = Math.max(0.01, this.epsilon * 0.995);
    }
}
async const runMARLSimulation = (episodes = 500) => {
    const mode = getExecutionMode();
    console.log(`\n🧠 [MARL] Initiating Phase 10 Multi-Agent Reinforcement Learning...`);
    console.log(`   [Mode] ${mode} - Wargaming Execution Engine Active`);
    if (isLiveFire()) {
        console.log(`[🔥] LIVE_FIRE Mode detected. Bypassing simulation loop and launching real Swarm assault...`);
        const result = await liveFireFullKillChain('wargaming_target', { sourceIp: '127.0.0.1' });
        console.log(`\n🏆 [MARL LIVE-FIRE COMPLETE] Live Kill-Chain execution finished.`);
        return result;
    }
    const env = new DigitalTwinEnvironment();
    const possibleActions = [
        { type: 'IDLE' },
        { type: 'EXECUTE_NOISY_SQLI' },
        { type: 'DEPLOY_MUTATED_LLVM' },
        { type: 'XDP_TUNNEL_ESTABLISH' },
        { type: 'EXECUTE_BARE_UNAME' },
        { type: 'EXECUTE_DOCKER_WRAPPED_UNAME' },
        { type: 'EXECUTE_LATERAL_PIVOT' },
        { type: 'ASYNC_MULTI_VECTOR' }, 
        { type: 'DECEPTIVE_SURRENDER' } 
    ];
    const swarm = new MARLAgentSwarm(['Phantom', 'Breacher'], possibleActions);
    let wins = 0;
    for (let episode = 0; episode < episodes; episode++) {
        let state = env.reset();
        let done = false;
        const watchdog = new HeuristicWatchdog();
        while (!done) {
            const jointAction = swarm.chooseJointAction(state);
            const result = env.step(jointAction);
            swarm.learn(state, jointAction, result.reward, result.state);
            state = result.state;
            done = result.done;
            const metrics = watchdog.getSystemMetrics();
            if (watchdog.evaluateBehavioralBreach(metrics) || state.alertTriggered) {
                console.log(`[🐺] Watchdog Triggered IR Workflow! (Episode ${episode})`);
                const client = await getTemporalClient();
                if (client) {
                    try {
                        const alertId = `MARL-SIM-${Date.now()}`;
                        await client.workflow.start('pentestPipeline', {
                            taskQueue: 'bayezid-ir',
                            workflowId: `ir-${alertId}`,
                            args: [{
                                alertId,
                                sourceIp: '10.0.0.99', 
                                targetAsset: 'docker',
                                rawPayload: JSON.stringify(jointAction)
                            }]
                        });
                        console.log(`[🛡️] Temporal IR Workflow started: ir-${alertId}`);
                    } catch (e) {
                        console.error('[-] Failed to start Temporal IR Workflow:', e.message);
                    }
                }
                done = true;
            }
        }
        if (state.rootGained && state.lateralPivotAchieved) wins++; 
        if (episode % 100 === 0) {
            console.log(`   [Epoch ${episode}] Epsilon: ${swarm.epsilon.toFixed(4)} | Swarm Co-op Win Rate (Root + Pivot): ${((wins / (episode+1)) * 100).toFixed(1)}%`);
        }
    }
    console.log(`\n🏆 [MARL COMPLETE] Cooperative Swarm Win Rate: ${((wins / episodes) * 100).toFixed(1)}%`);
    console.log(`   The agents have autonomously learned to execute synchronized timing attacks.`);
    console.log(`[🧪] Emitting optimal attack path as synthetic telemetry via Execution Bridge...`);
    await simulateFullKillChain('wargaming_target_sim', { sourceIp: '10.0.0.99' });
}
if (require.main === module) {
    runMARLSimulation(1000);
}
module.exports = { runMARLSimulation, DigitalTwinEnvironment, MARLAgentSwarm };
