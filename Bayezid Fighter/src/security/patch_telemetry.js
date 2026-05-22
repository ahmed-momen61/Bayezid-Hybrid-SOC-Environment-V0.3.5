const fs = require('fs');
const path = require('path');

const aiServicePath = path.join(__dirname, 'aiService.js');
let aiServiceCode = fs.readFileSync(aiServicePath, 'utf8');

if (!aiServiceCode.includes("const { dataHarvester } = require('../core_ai/bayezidBrain');")) {
    aiServiceCode = aiServiceCode.replace(
        "const { spawn } = require('child_process');",
        "const { spawn } = require('child_process');\nconst { dataHarvester } = require('../core_ai/bayezidBrain');"
    );
}

const agentsToPatch = [
    { name: 'Scout', func: 'runScoutAgent' },
    { name: 'Breacher', func: 'runBreacherAgent' },
    { name: 'Phantom', func: 'runPhantomAgent' },
    { name: 'Chameleon', func: 'runChameleonAgent' },
    { name: 'ZeroDayForge', func: 'runZeroDayForgeAgent' },
    { name: 'Alchemist', func: 'runAlchemistAgent' },
    { name: 'Mirage', func: 'runMirageAgent' },
    { name: 'Scribe', func: 'runScribeAgent' },
    { name: 'Action', func: 'runActionAgent' },
    { name: 'Auditor', func: 'runAuditorAgent' },
    { name: 'StealthScribe', func: 'runStealthScribeAgent' },
    { name: 'Veto', func: 'runVetoAgent' },
    { name: 'ShadowRouter', func: 'runShadowRouterAgent' },
    { name: 'ForensicRCA', func: 'runForensicRCAAgent' },
    { name: 'Warden', func: 'runWardenSandbox' },
    { name: 'Overlord', func: 'runOverlordAgent' }
];

for (const agent of agentsToPatch) {
    const returnRegex = new RegExp(`return \\{ agent: "${agent.name}"(.*?)\\};`, 'g');
    if (!aiServiceCode.includes(`dataHarvester.harvestAgentExecution('${agent.name}'`)) {
        aiServiceCode = aiServiceCode.replace(returnRegex, (match) => {
            return `try { dataHarvester.harvestAgentExecution('${agent.name}', { targetInfo }, { success: true, result: "Telemetry ingested" }); } catch(e) {}\n        ${match}`;
        });
    }
}

fs.writeFileSync(aiServicePath, aiServiceCode);
console.log("[+] Injected telemetry hooks into aiService.js");

const wingmanServicePath = path.join(__dirname, 'wingmanService.js');
let wingmanCode = fs.readFileSync(wingmanServicePath, 'utf8');

if (!wingmanCode.includes("dataHarvester.harvestWingmanInteraction")) {
    const finalReturn = `return finalContent;`;
    if (wingmanCode.includes(finalReturn)) {
        wingmanCode = wingmanCode.replace(
            finalReturn,
            `try {
                const { dataHarvester } = require('../core_ai/bayezidBrain');
                dataHarvester.harvestWingmanInteraction(sessionId, messages[messages.length - 1].content, allToolCalls, finalContent);
            } catch(e) {}\n        return finalContent;`
        );
        fs.writeFileSync(wingmanServicePath, wingmanCode);
        console.log("[+] Injected DPO telemetry hook into wingmanService.js (processMessage)");
    }
}
