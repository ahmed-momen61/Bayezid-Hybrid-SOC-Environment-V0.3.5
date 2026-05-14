const axios = require('axios');
const SwarmCrypto = require('./swarmCrypto');

const runSwarmSimulation = async() => {
    console.log("🐝 Initiating Bayezid Swarm Network Simulation...\n");

    const zeroDayFeatures = {
        length: 150,
        special_chars: 25,
        entropy: 5.99,
        keyword_count: 5
    };

    console.log("[1] Hacker attempting to inject poisoned intel...");
    try {
        await axios.post('http://localhost:3000/api/v1/swarm/sync', {
            features: zeroDayFeatures,
            signature: "fake_hacker_signature_deadbeef1234",
            sourceNode: "Unknown Node"
        });
    } catch (error) {
        console.log(`✅ Success: Bayezid destroyed the forged payload! (Status: ${error.response.status})\n`);
    }

    console.log("[2] Ministry of Health Node sending VALID signed intel...");
    const validSignature = SwarmCrypto.signSwarmPayload(zeroDayFeatures);

    try {
        const response = await axios.post('http://localhost:3000/api/v1/swarm/sync', {
            features: zeroDayFeatures,
            signature: validSignature,
            sourceNode: "Ministry of Health (Node-2)"
        });
        console.log(`✅ Success: Intel assimilated! (Response: ${response.data.message})`);
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
};

runSwarmSimulation();