const fs = require('fs');
const path = require('path');
const stripComments = require('strip-comments'); // We already have this in package.json from a previous turn

const aiServicePath = path.join(__dirname, 'aiService.js');
let aiServiceCode = fs.readFileSync(aiServicePath, 'utf8');

console.log("[+] Stripping all comments from aiService.js...");
aiServiceCode = stripComments(aiServiceCode);

console.log("[+] Injecting securityGovernor into aiService.js...");
if (!aiServiceCode.includes("const { isAllowedTarget } = require('./securityGovernor');")) {
    aiServiceCode = `const { isAllowedTarget } = require('./securityGovernor');\n` + aiServiceCode;
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
    const funcRegex = new RegExp(`const ${agent.func} = async\\((.*?targetInfo.*?)\\) => \\{`, 'g');
    
    // Some agents might use different variable names for target, but targetInfo is standard.
    // We inject the check right after the pause check if it exists, or just at the top of the function.
    if (!aiServiceCode.includes(`if (!isAllowedTarget(`)) {
        aiServiceCode = aiServiceCode.replace(funcRegex, (match) => {
            return `${match}\n        if (!isAllowedTarget(targetInfo)) { return { status: 'BLOCKED', message: 'Governor Lockout' }; }\n`;
        });
    }
}

fs.writeFileSync(aiServicePath, aiServiceCode);
console.log("[+] Governor injected and comments stripped from aiService.js");

// Do the same for server.js to ensure no comments exist
const serverPath = path.join(__dirname, 'server.js');
let serverCode = fs.readFileSync(serverPath, 'utf8');
serverCode = stripComments(serverCode);
fs.writeFileSync(serverPath, serverCode);
console.log("[+] Comments stripped from server.js");

