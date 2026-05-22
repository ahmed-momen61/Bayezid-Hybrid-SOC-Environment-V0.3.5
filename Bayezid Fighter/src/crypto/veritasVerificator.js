const { veritasChain } = require('./veritasProof');

class VeritasVerificator {
    constructor() {
        this.chain = veritasChain;
    }

    /**
     * Records a formal verification proof for a structural patch.
     * @param {string} containerName 
     * @param {string} structuralPatch 
     */
    verifyImmunization(containerName, structuralPatch) {
        console.log(`\n[🧮] VERITAS: Generating ZK-SNARK for Structural Immunization...`);
        
        const decisionData = {
            action: 'IMMUNIZE_REPLICA',
            target: containerName,
            patchSignature: Buffer.from(structuralPatch).toString('base64'),
            policyVersion: '11.0.0-IMMORTAL_FORTRESS'
        };

        // This pushes to the Bull queue and generates the Groth16 proof asynchronously
        const block = this.chain.recordDecision('STRUCTURAL_PATCH', decisionData, { operator: 'SelfHealingModule' });
        
        console.log(`[🔐] Formal Verification Block Queued: Hash Pending...`);
        return block;
    }
}

// Export a singleton instance and also proxy the base chain for backward compatibility
const verificator = new VeritasVerificator();
module.exports = { VeritasVerificator: verificator, veritasChain: verificator.chain };
