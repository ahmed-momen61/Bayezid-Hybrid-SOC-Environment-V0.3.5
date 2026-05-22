const { isAllowedTarget } = require('../securityGovernor');
const { dataHarvester } = require('../bayezidBrain');
const fs = require('fs');
const path = require('path');

const runTests = async () => {
    console.log(`\n[🧪] Initiating Bayezid Production Tests...`);
    let passed = 0;
    let failed = 0;

    // Test 1: Governor Lockout on Localhost
    console.log(`\n--- Test 1: Security Governor ---`);
    process.env.NODE_ENV = 'PRODUCTION'; // Bypass dev lock for test
    const target1 = '127.0.0.1';
    if (!isAllowedTarget(target1)) {
        console.log(`[✅] Passed: Governor successfully blocked ${target1}`);
        passed++;
    } else {
        console.error(`[❌] Failed: Governor allowed ${target1}`);
        failed++;
    }

    // Test 2: Governor Lockout on Dev Environment
    process.env.NODE_ENV = 'DEVELOPMENT';
    const target2 = '104.21.55.1'; // External IP
    if (!isAllowedTarget(target2)) {
        console.log(`[✅] Passed: Governor successfully blocked external IP in DEVELOPMENT mode`);
        passed++;
    } else {
        console.error(`[❌] Failed: Governor allowed external IP in DEVELOPMENT mode`);
        failed++;
    }
    process.env.NODE_ENV = 'PRODUCTION'; // Reset

    // Test 3: Telemetry Harvest Flow
    console.log(`\n--- Test 2: Telemetry & Harvester ---`);
    try {
        dataHarvester.harvestAgentExecution('TestAgent', { target: '10.0.0.1' }, { success: true });
        console.log(`[✅] Passed: dataHarvester executed asynchronously without throwing.`);
        passed++;
    } catch (e) {
        console.error(`[❌] Failed: dataHarvester threw an error: ${e.message}`);
        failed++;
    }

    // Test 4: Comment Stripping Verification
    console.log(`\n--- Test 3: No-Comments Directive Verification ---`);
    const serverPath = path.join(__dirname, '..', 'server.js');
    const serverCode = fs.readFileSync(serverPath, 'utf8');
    // Remove string literals matching http:// or https:// before checking for comments
    const codeToCheck = serverCode.replace(/https?:\/\//g, '');
    if (!codeToCheck.includes('//') && !codeToCheck.includes('/*')) {
        console.log(`[✅] Passed: server.js is clean. No comments detected.`);
        passed++;
    } else {
        console.error(`[❌] Failed: server.js still contains comments.`);
        failed++;
    }

    console.log(`\n[🏁] Test Suite Completed. Passed: ${passed} | Failed: ${failed}`);
    if (failed > 0) process.exit(1);
    process.exit(0);
};

runTests();
