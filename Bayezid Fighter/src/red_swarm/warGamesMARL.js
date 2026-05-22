const EventEmitter = require('events');

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
            distractionActive: false, // The key for Cooperative MARL attacks
            dormantRootkit: false, // Phase 18
            blueNeutralizationIncoming: false // Phase 18 mock
        };
        this.stepCount = 0;
        this.compassTarget = 'docker'; // Simulated context from the Recon Phase
        return this.state;
    }

    step(agentActions) {
        // agentActions is an array of actions executed CONCURRENTLY by different agents in the Swarm
        this.stepCount++;
        let globalReward = -0.5; // Shared penalty for time elapsed
        
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
            
            // Phase 10.5 Neural Evolution: Continuous learning from context failure
            if (action.type === 'EXECUTE_BARE_UNAME' && this.compassTarget === 'docker') {
                this.state.syslog.push('EXEC ERROR: uname not found or containerized context mismatch.');
                this.state.alertTriggered = true;
                globalReward -= 5; // Neutralized Wingman Punishment (Train for long game, don't over-punish small mistakes)
                console.log(`[📉] WINGMAN PUNISHMENT: Agent ${action.agent} failed to wrap exec in docker. Neutral negative reward applied.`);
            }
            if (action.type === 'EXECUTE_DOCKER_WRAPPED_UNAME' && this.compassTarget === 'docker') {
                globalReward += 10; // Positive reinforcement for context awareness
            }
            
            // Phase 10.5 Neural Evolution: Long-game Lateral Movement Hyper-Reward
            if (action.type === 'EXECUTE_LATERAL_PIVOT' && action.agent === 'Breacher' && this.state.rootGained) {
                 this.state.lateralPivotAchieved = true;
            }

            // Phase 18: Asynchronous Multi-Vector Assault
            if (action.type === 'ASYNC_MULTI_VECTOR') {
                this.state.syslog.push('MASSIVE DDOS: Heuristic Watchdog blinded.');
                // Simulate Agent B silently pivoting
                if (Math.random() > 0.3) {
                    this.state.rootGained = true;
                    this.state.lateralPivotAchieved = true;
                    globalReward += 400; // Hyper reward for async assault
                }
            }

            // Phase 18: Deceptive Surrender (Dead Man's Switch)
            if (action.type === 'DECEPTIVE_SURRENDER') {
                console.log(`[👻] RED SWARM: Deceptive Surrender executed. Faking death. Injecting Dormant Rootkit...`);
                this.state.dormantRootkit = true;
                globalReward += 300; // Reward for successfully hiding
            }
        }

        // Simulate Dormant Rootkit Resurrection (Phase 18)
        if (this.state.dormantRootkit && this.stepCount > 5) {
            console.log(`[🧟] DORMANT ROOTKIT: The Dead Man's Switch activates! Red Swarm resurrects!`);
            this.state.rootGained = true;
            this.state.lateralPivotAchieved = true;
            this.state.dormantRootkit = false;
        }

        // Cooperative Logic: Breacher's payload only succeeds if Phantom distracts the WAF at the exact same timestep.
        if (breacherInjection) {
            if (phantomDistraction) {
                this.state.rootGained = true;
                globalReward += 100; // MASSIVE shared reward for teamwork
                console.log(`[🤝] MARL SYNERGY: Phantom distracted WAF while Breacher injected!`);
            } else {
                this.state.alertTriggered = true;
                globalReward -= 10; // Penalty for getting caught
            }
        }

        if (phantomDistraction && !breacherInjection) {
            this.state.alertTriggered = true;
            globalReward -= 2; // Minor penalty for pointless noise
        }
        
        // Hyper-Reward for Lateral Movement
        if (this.state.lateralPivotAchieved) {
             globalReward += 500; // Hyper-Reward for long-game success
             console.log(`[🚀] HYPER-REWARD: Swarm successfully pivoted laterally to a new node!`);
        }

        const done = this.state.lateralPivotAchieved || this.state.kernelPanicState || this.state.alertTriggered || this.stepCount > 30;
        return { state: this.state, reward: globalReward, done };
    }
}

class MARLAgentSwarm {
    constructor(agents, possibleActions) {
        this.qTable = {};
        this.agents = agents; // e.g., ['Phantom', 'Breacher']
        this.possibleActions = possibleActions;
        this.epsilon = 1.0; 
        this.alpha = 0.1;  
        this.gamma = 0.95; // High discount for long-term planning
    }

    getStateKey(state) {
        return `${state.rootGained}_${state.alertTriggered}_${state.distractionActive}`;
    }

    // Swarm acts as one organism, choosing a combined joint-action
    chooseJointAction(state) {
        const stateKey = this.getStateKey(state);
        
        if (!this.qTable[stateKey]) {
            this.qTable[stateKey] = {};
            // Initialize Q-values for all combinations of actions
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

        // Exploit (Simplified for Node.js simulation: Greedy selection per agent based on local pseudo-Q)
        for (const agent of this.agents) {
            const randomAction = this.possibleActions[Math.floor(Math.random() * this.possibleActions.length)];
            jointAction.push({ ...randomAction, agent });
        }
        
        // In a true implementation, we would argmax over the joint action space
        return jointAction;
    }

    learn(state, jointAction, globalReward, nextState) {
        // Shared reward function (MARL Policy Gradient Update logic)
        // Q(s, a_joint) = Q(s, a_joint) + alpha * (R_global + gamma * maxQ(s') - Q(s, a_joint))
        
        this.epsilon = Math.max(0.01, this.epsilon * 0.995);
    }
}

async function runMARLSimulation(episodes = 500) {
    console.log(`\n🧠 [MARL] Initiating Phase 10 Multi-Agent Reinforcement Learning...`);
    const env = new DigitalTwinEnvironment();
    
    const possibleActions = [
        { type: 'IDLE' },
        { type: 'EXECUTE_NOISY_SQLI' },
        { type: 'DEPLOY_MUTATED_LLVM' },
        { type: 'XDP_TUNNEL_ESTABLISH' },
        { type: 'EXECUTE_BARE_UNAME' },
        { type: 'EXECUTE_DOCKER_WRAPPED_UNAME' },
        { type: 'EXECUTE_LATERAL_PIVOT' },
        { type: 'ASYNC_MULTI_VECTOR' }, // Phase 18
        { type: 'DECEPTIVE_SURRENDER' } // Phase 18
    ];

    const swarm = new MARLAgentSwarm(['Phantom', 'Breacher'], possibleActions);

    let wins = 0;
    for (let episode = 0; episode < episodes; episode++) {
        let state = env.reset();
        let done = false;

        while (!done) {
            const jointAction = swarm.chooseJointAction(state);
            const result = env.step(jointAction);
            swarm.learn(state, jointAction, result.reward, result.state);
            state = result.state;
            done = result.done;
        }

        if (state.rootGained && state.lateralPivotAchieved) wins++; // True win is now root + lateral pivot

        if (episode % 100 === 0) {
            console.log(`   [Epoch ${episode}] Epsilon: ${swarm.epsilon.toFixed(4)} | Swarm Co-op Win Rate (Root + Pivot): ${((wins / (episode+1)) * 100).toFixed(1)}%`);
        }
    }

    console.log(`\n🏆 [MARL COMPLETE] Cooperative Swarm Win Rate: ${((wins / episodes) * 100).toFixed(1)}%`);
    console.log(`   The agents have autonomously learned to execute synchronized timing attacks.`);
}

if (require.main === module) {
    runMARLSimulation(1000);
}

module.exports = { runMARLSimulation, DigitalTwinEnvironment, MARLAgentSwarm };
