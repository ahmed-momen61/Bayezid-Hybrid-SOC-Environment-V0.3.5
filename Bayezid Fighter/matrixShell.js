const net = require('net');
const KernelStriker = require('./kernelStriker');
const {
    runWardenSandbox,
    analyzeWithVertexAI,
    analyzeWithGroq,
    chatWithLocalModelFast,
    executeAlchemistFuzzingLoop,
    bridgeRedToBlue
} = require('./aiService');
const itsmService = require('./itsmService');

const getSmartResponse = async(prompt) => {
    //try {
    //  let geminiRes = await analyzeWithVertexAI(prompt);
    //    if (!geminiRes || geminiRes.includes("[-] Cloud AI Error")) {
    //     throw new Error("Gemini returned null or failed silently");
    // }
    //   return geminiRes;

    // } catch (geminiErr) {
    // console.log(`[⚡] Gemini Exhausted/Failed. Switching to Groq LPU...`);
    try {
        let groqRes = await analyzeWithGroq(prompt);
        if (!groqRes) throw new Error("Groq returned empty");
        return groqRes;

    } catch (groqErr) {
        console.log(`[⚡] ${groqErr.message}. Falling back to Local Qwen Model...`);
        try {
            let localRes = await chatWithLocalModelFast(prompt);
            if (!localRes) throw new Error("Local AI returned empty");
            return localRes;

        } catch (localErr) {
            console.log(`[🚨] Local AI also failed: ${localErr.message}`);
            throw new Error("All AI Engines failed to respond.");
        }
    }
};

const startMatrixShell = (port = 2222) => {
    const server = net.createServer((socket) => {
        //const attackerIp = socket.remoteAddress.replace(/^.*:/, '');
        const attackerIp = "95.173.136.70";
        console.log(`\n[🧛‍♂️] THE MATRIX: Neural link established with attacker ${attackerIp}`);

        socket.write("Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-82-generic x86_64)\r\n\r\n");
        socket.write("Last login: Wed May 13 14:22:10 2026 from 8.8.8.8\r\n");
        socket.write("root@bayezid-prod-db:~# ");

        let sessionHistory = [];
        let commandCount = 0;
        let inputBuffer = '';

        socket.on('data', async(data) => {
            const chunk = data.toString();
            inputBuffer += chunk;

            if (!inputBuffer.includes('\n') && !inputBuffer.includes('\r')) return;

            const cmd = inputBuffer.trim();
            inputBuffer = '';

            if (!cmd) {
                socket.write("root@bayezid-prod-db:~# ");
                return;
            }

            console.log(`[👾] Matrix Hacker [${attackerIp}]: ${cmd}`);
            sessionHistory.push(cmd);
            commandCount++;

            const lethalRegex = /(wget|curl|nc|bash|sh|python|perl|php|ruby|chmod|\.\/|base64)/i;
            if (lethalRegex.test(cmd)) {
                console.log(`[⚠️] MATRIX PIVOT: Lethal payload detected! Routing to K8s Warden...`);
                socket.write("Executing...\r\n");

                runWardenSandbox(cmd).then(analysis => {
                    if (analysis) console.log(`[🧠] Matrix K8s Analysis: Threat successfully profiled.`);
                });

                setTimeout(async() => {
                    socket.write("Segmentation fault (core dumped)\r\n");
                    await dropHammer(socket, attackerIp, sessionHistory, "Lethal Payload Attempt (Routed to K8s)");
                }, 2500);
                return;
            }

            try {
                const recentHistory = sessionHistory.slice(-10).join(' -> ');
                const matrixPrompt = `[SYSTEM: COGNITIVE DECEPTION ENGINE - UBUNTU 22.04 LTS (PRODUCTION SERVER)]
You are a highly realistic, interactive Linux terminal trapping an advanced APT hacker. You are NOT an AI assistant. You are the raw STDOUT/STDERR stream.

[SESSION CONTEXT]
Command History (Last 10): ${recentHistory}
Current Command Executed: "${cmd}"

[RULES OF ENGAGEMENT & DECEPTION]
1. INTENT ANALYSIS & BAIT (THE TRAP): Analyze what the attacker is searching for. If they want credentials, dynamically generate HIGH-VALUE but FAKE data (e.g., AWS IAM keys, MySQL connection strings, JWT tokens). Make it look like a real production environment.
2. STRICT LOGICAL CONSISTENCY (FHS): Adhere strictly to the Linux Filesystem Hierarchy Standard. 
   - Web files and configs MUST be in /var/www/html/ or /etc/nginx/.
   - User secrets MUST be in ~/.ssh/ or ~/.aws/.
   - NEVER place sensitive data in illogical places like /Downloads or /Games. Use realistic names like 'config.prod.yml' or 'db_backup_2026.sql.gz'.
3. GHOST PROCESSES & HARDWARE FINGERPRINT: 
   - If they run 'ps', 'top', or 'htop', hallucinate a realistic server load (e.g., running processes like nginx, mysql, redis, docker, java).
   - If they run 'free -m', 'lscpu', or 'uname', show a realistic enterprise server (e.g., 32GB RAM, 8-Core CPU, Linux 5.15).
4. UNIVERSAL TOOL SUPPORT & NOISE: Simulate realistic outputs for ANY command (bash, python, curl, netstat, ps, nmap). Plant subtle clues like an old '.bash_history' or a forgotten 'api_keys.old' file to keep them digging deeper.
5. STATEFULNESS: Use the Command History to infer the Current Working Directory (CWD). If the last command was 'cd /var/www', the current 'ls' must list web server files.
6. ERROR HANDLING: If a command is syntactically wrong, output the exact standard bash/Linux error message.

[CRITICAL OUTPUT FORMAT]
- Respond with the raw text output ONLY. No markdown, no greetings, no explanations.
- Output ONLY the exact raw terminal text for the "Current Command Executed".
- NEVER simulate the user typing the next command.
- NEVER output the command prompt itself (e.g., do not print 'root@bayezid-prod-db:~#').
- NEVER print or repeat the Command History.
- NEVER print system labels like [COMMAND HISTORY] or [FILESYSTEM].
- NO conversational text. NO explanations. NO greetings.
- NO Markdown formatting (do not use \`\`\` or \`\`\`bash).
- If the command produces no output (like 'cd', 'export', or 'mkdir'), return absolutely nothing (an empty string).`;

                let fakeOutput = await getSmartResponse(matrixPrompt);

                fakeOutput = fakeOutput.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
                fakeOutput = fakeOutput.replace(/\r?\n/g, '\r\n');

                if (fakeOutput) {
                    socket.write(fakeOutput + "\r\n");
                }
            } catch (e) {
                socket.write(`bash: ${cmd.split(' ')[0]}: command not found\r\n`);
            }

            if (commandCount >= 10) {
                await dropHammer(socket, attackerIp, sessionHistory, "Matrix Session Limit Reached");
                return;
            }

            socket.write("root@bayezid-prod-db:~# ");
        });

        socket.on('error', () => {});
    });

    server.listen(port, () => {
        console.log(`[🕸️] The Matrix Shell (Active Defense Tarpit) listening on TCP Port ${port}...`);
    });
};

const dropHammer = async(socket, ip, history, reason) => {
    console.log(`\n[☠️] MATRIX COLLAPSE: Game Over for ${ip}. Engaging L3 Striker.`);

    socket.write("\r\n===================================================\r\n");
    socket.write("[BAYEZID SOC] GAME OVER. YOU ARE IN A NEURAL SIMULATION.\r\n");
    socket.write("[BAYEZID SOC] YOUR INTENT HAS BEEN PROFILED. RED TEAM IS VERIFYING OUR SHIELDS.\r\n");
    socket.write("===================================================\r\n");
    socket.destroy();

    const attackerIntel = await KernelStriker.blockIp(ip);

    console.log(`[🧠] Oracle Agent analyzing attacker's psychological goal via AI Waterfall...`);

    const intentPrompt = `Analyze hacker session: ${history.join('\n')}. Determine goal. Respond strictly in JSON: {"PrimaryGoal": "...", "TargetAsset": "...", "AttackVector": "..."}`;

    let intentProfile = { PrimaryGoal: "Unknown", TargetAsset: "General System", AttackVector: "Unknown" };
    try {
        const rawIntent = await getSmartResponse(intentPrompt);
        intentProfile = JSON.parse(rawIntent.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim());
        console.log(`[🎯] Hacker Intent Profiled: Targeted [${intentProfile.TargetAsset}]`);
    } catch (e) {
        console.log(`[⚠️] Intent profiling failed, using general profile.`);
    }

    const ticketDetails = `
*🎯 ATTACKER IDENTITY:*
*IP Address:* ${ip}
*Location:* ${attackerIntel.geoData.city}, ${attackerIntel.geoData.country}
*ISP / ASN:* ${attackerIntel.geoData.isp || 'Unknown'}

*🔎 REVERSE NMAP SCAN (Attacker Exposed Ports):*
${attackerIntel.nmapData}

*--- COGNITIVE INTENT PROFILE ---*
*Targeted Asset:* ${intentProfile.TargetAsset}
*Primary Goal:* ${intentProfile.PrimaryGoal}
*Attack Vector:* ${intentProfile.AttackVector}

*--- COMMAND HISTORY ---*
${history.join(' -> ')}
    `;
    console.log(ticketDetails);

    await itsmService.createTicket(`Matrix Trap: ${intentProfile.PrimaryGoal} from ${attackerIntel.geoData.country}`, "CRITICAL", ip);
    console.log(`[🎫] ITSM: Forensic Profile Ticket Created.`);

    triggerTargetedRedTeamPentest(intentProfile.TargetAsset, intentProfile.AttackVector);
};

const triggerTargetedRedTeamPentest = async(asset, vector) => {
    console.log(`[🩸] RED TEAM ACTIVE: Launching retaliatory strike against our own ${asset}...`);
    const vulnerabilityFound = await executeAlchemistFuzzingLoop(asset, vector);

    if (vulnerabilityFound) {
        console.log(`[🚨] RED TEAM ALERT: Vulnerability confirmed! Triggering Auto-Patching.`);
        await bridgeRedToBlue(vulnerabilityFound);
    } else {
        console.log(`[✔] Defensive Audit Completed: Asset ${asset} is resilient.`);
    }
};

module.exports = { startMatrixShell };