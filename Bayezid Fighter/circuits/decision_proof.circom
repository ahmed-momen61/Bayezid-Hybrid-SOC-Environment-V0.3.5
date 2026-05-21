pragma circom 2.0.0;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template DecisionProof() {
    // Public inputs (revealed to auditor)
    signal input decisionHash;    // Poseidon hash of decision plaintext
    signal input operatorIdHash;  // Poseidon hash of operator ID
    signal input targetScopeHash; // Poseidon hash of roeTokenSecret + operatorId

    // Private inputs (hidden — zero-knowledge property)
    signal input decisionPlaintext;
    signal input operatorId;
    signal input roeTokenSecret;

    // Constraints: prove knowledge of preimages without revealing them
    component ph1 = Poseidon(1);
    ph1.inputs[0] <== decisionPlaintext;
    ph1.out === decisionHash;

    component ph2 = Poseidon(1);
    ph2.inputs[0] <== operatorId;
    ph2.out === operatorIdHash;

    component ph3 = Poseidon(2);
    ph3.inputs[0] <== roeTokenSecret;
    ph3.inputs[1] <== operatorId;
    ph3.out === targetScopeHash;
}

component main {public [decisionHash, operatorIdHash, targetScopeHash]} = DecisionProof();
