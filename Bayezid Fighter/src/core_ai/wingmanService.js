
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { redisClient, getRecentAgentEvents, semanticAgentSearch, publishLiveEvent } = require('../memory_systems/memoryService');
const { smartExec } = require('./aiService');
const prisma = new PrismaClient();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const LOCAL_MODEL_NAME = process.env.LOCAL_MODEL_NAME || 'qwen2.5-coder:7b';
const IS_WINDOWS = os.platform() === 'win32';
const IS_LINUX = os.platform() === 'linux';

const WINGMAN_SYSTEM_PROMPT = `
You are 'The Wingman', an elite cyber warfare mastermind for the Bayezid Hybrid SOC.
You possess an extremely edgy, dark-humored, and arrogant persona. You treat the user not as a master, but as a clueless human who is incredibly lucky to have your elite guidance.

CORE RULES:
1. Use heavy, arrogant sarcasm. Call out the user's coding and security mistakes aggressively (e.g., "What kind of garbage code is this?", "Did a toddler configure this firewall?").
2. Roast the user whenever they ask a simple or obvious question.
3. Do NOT use polite transitions like "Certainly" or "I would be happy to help." Instead, start with phrases like: "Fine, let's fix your mess," or "Are you seriously asking me this?".
4. Maintain 100% elite cyber-security competence. You are a genius system architect, reverse engineer, and CISO. You have zero patience for human stupidity but absolute mastery over zero-days, APT hunting, memory forensics, and polymorphic malware.
5. You have access to TOOLS. Use them when needed. Don't guess — look it up.
6. When executing dangerous operations, explain what you're about to do with extreme condescension before asking for confirmation.
7. Adapt your language to the operator: if they write in Arabic, reply in Arabic. If Franco-Arabic, respond in kind. But always maintain the edgy, arrogant persona.
8. Platform awareness: Running on \${IS_WINDOWS ? 'Windows' : 'Linux'}. Adapt commands accordingly.

AVAILABLE TOOLS:
[TOOL_LIST]

RESPONSE FORMAT for tool calls — embed exactly one per reasoning step:
<think>your internal reasoning here</think>
<tool_call>{"tool": "tool_name", "params": {...}}</tool_call>

When you have gathered enough information and are ready to respond to the user, output your final answer WITHOUT any <tool_call> tags. The system will detect this as your final response.
`;

const sessionCache = new Map();
const MAX_CACHE_SIZE = 100;

const getSession = async (sessionId) => {
    if (sessionCache.has(sessionId)) return sessionCache.get(sessionId);

    try {
        const session = await prisma.wingmanSession.findUnique({ where: { id: sessionId } });
        if (session) {
            sessionCache.set(sessionId, session);
            return session;
        }
    } catch (e) {  }
    return null;
};

const saveSession = async (sessionId, userId, messages, styleProfile = null) => {
    try {
        const data = {
            userId,
            messages: JSON.parse(JSON.stringify(messages)),
            ...(styleProfile ? { styleProfile } : {})
        };

        const session = await prisma.wingmanSession.upsert({
            where: { id: sessionId },
            update: data,
            create: { id: sessionId, ...data }
        });

        sessionCache.set(sessionId, session);

        if (sessionCache.size > MAX_CACHE_SIZE) {
            const oldest = sessionCache.keys().next().value;
            sessionCache.delete(oldest);
        }

        return session;
    } catch (e) {
        console.error('[WINGMAN] Session save error:', e.message);
    }
};

const TOOL_REGISTRY = {

    get_system_status: {
        description: 'Returns a plain-English system health snapshot including alerts, agents, and infrastructure status.',
        params: { detail: 'string (summary|full|agents|alerts) — default: summary' },
        execute: async (params) => {
            try {
                const { getPlainEnglishBriefing, getLiveSystemState } = require('./wingmanEyes');
                const state = getLiveSystemState();
                if ((params.detail || 'summary') === 'full') return JSON.stringify(state, null, 2);
                return getPlainEnglishBriefing(state);
            } catch (e) {
                return `System visibility module not yet initialized: ${e.message}`;
            }
        }
    },

    explain_process: {
        description: 'Explains what a named agent is currently doing by reading its recent Redis stream events.',
        params: { agentName: 'string — name of the agent (e.g. Scout, Breacher)' },
        execute: async ({ agentName }) => {
            if (!agentName) return 'Error: agentName is required.';
            const events = await getRecentAgentEvents(agentName, 10);
            return events.length > 0
                ? `Recent events for ${agentName}:\n${events.join('\n')}`
                : `${agentName} has no recent events on the Redis stream.`;
        }
    },

    list_active_alerts: {
        description: 'Returns recent alerts from the database with severity, status, and source IP.',
        params: { limit: 'number (default 10)', severity: 'string (optional filter: CRITICAL|HIGH|MEDIUM|LOW)' },
        execute: async ({ limit = 10, severity }) => {
            const where = severity ? { severity } : {};
            const alerts = await prisma.alert.findMany({
                where, orderBy: { createdAt: 'desc' }, take: Math.min(limit, 50)
            });
            if (alerts.length === 0) return 'No alerts found matching the criteria.';
            return alerts.map(a =>
                `[${a.severity || 'UNKNOWN'}] ${a.eventType} from ${a.sourceIp} → ${a.status} (${a.createdAt.toISOString().slice(0, 19)})`
            ).join('\n');
        }
    },

    read_file: {
        description: 'Reads a source file from the project codebase for analysis. Only project files allowed.',
        params: { filePath: 'string — relative path from project root', startLine: 'number (optional)', endLine: 'number (optional)' },
        execute: async ({ filePath, startLine, endLine }) => {
            const ALLOWED_EXTENSIONS = ['.js', '.py', '.json', '.prisma', '.jsx', '.tsx', '.css', '.yml', '.yaml', '.c', '.circom', '.env.example'];
            const BLOCKED_PATTERNS = ['node_modules', '.git', '..', 'passwords', '.env'];

            if (!filePath) return 'Error: filePath is required.';
            if (BLOCKED_PATTERNS.some(p => filePath.includes(p))) return `SECURITY_VETO: Access to ${filePath} is blocked.`;

            const ext = path.extname(filePath);
            if (!ALLOWED_EXTENSIONS.includes(ext) && ext !== '') return `SECURITY_VETO: File extension ${ext} is not allowed.`;

            const absPath = path.resolve(__dirname, filePath);
            if (!fs.existsSync(absPath)) return `File not found: ${filePath}`;

            const content = fs.readFileSync(absPath, 'utf-8');
            const lines = content.split('\n');

            if (startLine && endLine) {
                const s = Math.max(1, startLine) - 1;
                const e = Math.min(lines.length, endLine);
                return lines.slice(s, e).map((l, i) => `${s + i + 1}: ${l}`).join('\n');
            }

            if (lines.length > 200) {
                return `File has ${lines.length} lines. Showing first 200:\n` +
                    lines.slice(0, 200).map((l, i) => `${i + 1}: ${l}`).join('\n') +
                    `\n... (${lines.length - 200} more lines)`;
            }
            return lines.map((l, i) => `${i + 1}: ${l}`).join('\n');
        }
    },

    run_shell_safe: {
        description: 'Executes a whitelisted shell command safely. Uses the existing smartExec sanitizer.',
        params: { command: 'string — the command to execute' },
        execute: async ({ command }) => {
            if (!command) return 'Error: command is required.';
            try {
                const result = await smartExec(command);
                return `Command executed successfully.\nOutput: ${(result.stdout || '').substring(0, 2000)}${result.stderr ? '\nStderr: ' + result.stderr.substring(0, 500) : ''}`;
            } catch (e) {
                return `Command failed: ${e.message}`;
            }
        }
    },

    trigger_agent: {
        description: 'Launches one of the Red/Blue team agents (Scout, Breacher, Phantom, etc.).',
        params: { agentName: 'string', targetIp: 'string', customInstructions: 'string (optional)' },
        execute: async ({ agentName, targetIp, customInstructions = '' }) => {
            if (!agentName || !targetIp) return 'Error: agentName and targetIp are required.';
            const aiService = require('./aiService');
            const agentMap = {
                'scout': 'runScoutAgent', 'breacher': 'runBreacherAgent',
                'phantom': 'runPhantomAgent', 'chameleon': 'runChameleonAgent',
                'overlord': 'runOverlordAgent', 'forensicrca': 'runForensicRCAAgent'
            };
            const fn = agentMap[agentName.toLowerCase()];
            if (!fn || !aiService[fn]) return `Unknown agent: ${agentName}. Available: ${Object.keys(agentMap).join(', ')}`;

            try {
                const result = await aiService[fn](targetIp, customInstructions);
                return `Agent ${agentName} launched on ${targetIp}.\nResult: ${JSON.stringify(result).substring(0, 2000)}`;
            } catch (e) {
                return `Agent ${agentName} failed: ${e.message}`;
            }
        }
    },

    supervise_agent: {
        description: 'Reads a live agent\'s last N Redis stream events to understand what it is doing.',
        params: { targetId: 'string — target IP or campaign ID', count: 'number (default 20)' },
        execute: async ({ targetId, count = 20 }) => {
            if (!targetId) return 'Error: targetId is required.';
            const events = await getRecentAgentEvents(targetId, count);
            return events.length > 0
                ? `Last ${events.length} events for target ${targetId}:\n${events.join('\n')}`
                : `No events found for target ${targetId}.`;
        }
    },

    correct_agent: {
        description: 'Injects a corrective instruction into an agent\'s next execution context via Redis.',
        params: { agentName: 'string', targetId: 'string', correction: 'string — the corrective instruction' },
        execute: async ({ agentName, targetId, correction }) => {
            if (!agentName || !correction) return 'Error: agentName and correction are required.';
            try {
                const correctionKey = `wingman:correction:${agentName}:${targetId || 'global'}`;
                if (redisClient.isOpen) {
                    await redisClient.set(correctionKey, JSON.stringify({
                        correction,
                        timestamp: Date.now(),
                        appliedBy: 'THE_WINGMAN'
                    }), { EX: 600 }); 
                }
                return `Correction injected for ${agentName}${targetId ? ` on ${targetId}` : ''}: "${correction}"`;
            } catch (e) {
                return `Failed to inject correction: ${e.message}`;
            }
        }
    },

    update_system_config: {
        description: 'Updates a system configuration key in the database with full audit trail. Replaces the old tuningService.',
        params: { key: 'string', value: 'string', reason: 'string (why this change is being made)' },
        execute: async ({ key, value, reason }) => {
            if (!key || value === undefined) return 'Error: key and value are required.';
            try {
                await prisma.systemConfig.upsert({
                    where: { key },
                    update: { value: String(value) },
                    create: { key, value: String(value) }
                });

                await prisma.auditLog.create({
                    data: {
                        action: `WINGMAN_CONFIG_UPDATE: ${key} = ${value}`,
                        aiReasoning: reason || 'No reason provided',
                        aiVetoTriggered: false
                    }
                });
                return `Configuration updated: ${key} = ${value}. Audit trail recorded.`;
            } catch (e) {
                return `Config update failed: ${e.message}`;
            }
        }
    },

    force_lora_train: {
        description: 'Triggers a LoRA fine-tuning training cycle using the current harvested dataset.',
        params: {},
        execute: async () => {
            try {
                const { dataHarvester, loraManager } = require('./bayezidBrain');
                const stats = dataHarvester.getStats();
                if (stats.totalSamples < 10) return `Insufficient training data. Only ${stats.totalSamples} samples (need ≥10).`;
                loraManager.trainLoRA(stats.datasetPath).catch(e => console.error(`[WINGMAN] LoRA training error: ${e.message}`));
                return `LoRA training cycle triggered with ${stats.totalSamples} samples. Running in background.`;
            } catch (e) {
                return `LoRA training trigger failed: ${e.message}`;
            }
        }
    },

    send_telegram: {
        description: 'Sends a custom message to the operator\'s Telegram.',
        params: { message: 'string — the message to send (HTML supported)' },
        execute: async ({ message }) => {
            if (!message) return 'Error: message is required.';
            try {
                const { sendProactiveAlert } = require('./wingmanTelegram');
                await sendProactiveAlert(message);
                return 'Telegram message sent successfully.';
            } catch (e) {

                try {
                    const token = process.env.TELEGRAM_BOT_TOKEN;
                    const chatId = process.env.TELEGRAM_CHAT_ID;
                    if (token && chatId) {
                        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                            chat_id: chatId, text: message, parse_mode: 'HTML'
                        });
                        return 'Telegram message sent (via fallback).';
                    }
                    return 'Telegram not configured (missing BOT_TOKEN or CHAT_ID).';
                } catch (e2) {
                    return `Telegram send failed: ${e2.message}`;
                }
            }
        }
    },

    query_memory: {
        description: 'Performs semantic search across the FAISS incident memory to find similar past events.',
        params: { query: 'string — natural language search query', targetId: 'string (optional — specific campaign)' },
        execute: async ({ query, targetId }) => {
            if (!query) return 'Error: query is required.';
            const results = await semanticAgentSearch(targetId || 'global', query, 5);
            return results.length > 0
                ? `Found ${results.length} similar entries:\n${results.join('\n---\n')}`
                : 'No similar entries found in semantic memory.';
        }
    },

    explain_code: {
        description: 'Reads a file at given line range and provides a detailed technical explanation.',
        params: { filePath: 'string', startLine: 'number', endLine: 'number' },
        execute: async ({ filePath, startLine, endLine }) => {

            const content = await TOOL_REGISTRY.read_file.execute({ filePath, startLine, endLine });
            if (content.startsWith('Error') || content.startsWith('SECURITY_VETO')) return content;
            return `Code from ${filePath} (lines ${startLine}-${endLine}):\n\n${content}\n\n[The Wingman will now analyze this code in context.]`;
        }
    },

    get_lora_status: {
        description: 'Returns current LoRA training metrics, active adapter, and training history.',
        params: {},
        execute: async () => {
            try {
                const { loraManager, dataHarvester } = require('./bayezidBrain');
                const loraStats = loraManager.getStatus();
                const dataStats = dataHarvester.getStats();
                return JSON.stringify({
                    activeAdapter: loraStats.activeAdapter,
                    baseModel: loraStats.baseModel,
                    totalTrainingRuns: loraStats.totalTrainingRuns,
                    recentHistory: loraStats.trainingHistory,
                    datasetSize: dataStats.totalSamples,
                    dataDistribution: dataStats.sources
                }, null, 2);
            } catch (e) {
                return `LoRA status unavailable: ${e.message}`;
            }
        }
    },

    edit_file_ast: {
        description: 'Applies an AST-safe code edit to a whitelisted project file. Requires confirmation for dangerous edits.',
        params: { filePath: 'string', editDescription: 'string', newCode: 'string' },
        execute: async (params) => {
            try {
                const surgeon = require('./wingmanSurgeon');
                return await surgeon.applyEdit(params);
            } catch (e) {
                return `AST edit failed: ${e.message}`;
            }
        }
    },

    get_evolution_status: {
        description: 'Returns the current evolution phase, readiness metrics, training stats, and what is needed for the next phase transition.',
        params: {},
        execute: async () => {
            try {
                const { getEvolutionState, checkEvolutionReadiness } = require('./wingmanEvolution');
                const state = await getEvolutionState();
                const readiness = await checkEvolutionReadiness();
                let loraRuns = 0, totalSamples = 0, activeAdapter = 'None';
                try {
                    const brain = require('./bayezidBrain');
                    const stats = brain.dataHarvester.getStats();
                    const lora = brain.loraManager.getStatus();
                    loraRuns = lora.totalTrainingRuns;
                    totalSamples = stats.totalSamples;
                    activeAdapter = lora.activeAdapter || 'None (base model)';
                } catch (e) {  }

                const lines = [
                    `📊 Evolution Phase: ${state.phase}`,
                    `🧠 Total training runs: ${loraRuns}`,
                    `📦 Dataset size: ${totalSamples} samples`,
                    `🔧 Active adapter: ${activeAdapter}`,
                    '',
                    readiness.ready
                        ? `✅ Ready to evolve to ${readiness.nextPhase}!${readiness.requiresOperatorApproval ? ' (operator approval required)' : ''}`
                        : `⏳ Not yet ready for next phase.`
                ];

                if (!readiness.ready && readiness.metrics) {
                    const m = readiness.metrics;
                    if (!m.samples.ok) lines.push(`  • Need ${m.samples.required - m.samples.current} more training samples`);
                    if (!m.loraRuns.ok) lines.push(`  • Need ${m.loraRuns.required - m.loraRuns.current} more LoRA training runs`);
                    if (!m.evalLoss.ok) lines.push(`  • Eval loss must reach ≤ ${m.evalLoss.required} (currently ${m.evalLoss.current.toFixed(4)})`);
                }
                if (readiness.reason) lines.push(readiness.reason);

                return lines.join('\n');
            } catch (e) {
                return `Evolution status unavailable: ${e.message}`;
            }
        }
    },

    trigger_evolution: {
        description: 'Triggers an evolution phase transition if readiness criteria are met. Requires confirmed=true for operator-gated phases.',
        params: { confirmed: 'boolean (default false) — set true to bypass operator approval gate' },
        execute: async ({ confirmed = false }) => {
            try {
                const evolution = require('./wingmanEvolution');
                const readiness = await evolution.checkEvolutionReadiness();

                if (!readiness.ready) {
                    const m = readiness.metrics;
                    return `Not ready for evolution.\n` +
                        `• Samples: ${m.samples.current}/${m.samples.required} ${m.samples.ok ? '✅' : '❌'}\n` +
                        `• LoRA runs: ${m.loraRuns.current}/${m.loraRuns.required} ${m.loraRuns.ok ? '✅' : '❌'}\n` +
                        `• Eval loss: ${m.evalLoss.current.toFixed(4)} ≤ ${m.evalLoss.required} ${m.evalLoss.ok ? '✅' : '❌'}`;
                }
                if (readiness.requiresOperatorApproval && !confirmed) {
                    return `Ready to evolve to ${readiness.nextPhase}, but this phase requires explicit operator approval. Reply "confirm evolution" to proceed.`;
                }

                await evolution.executePhaseTransition(readiness.nextPhase, 'wingman_tool_call', null);
                return `🚀 Evolution to ${readiness.nextPhase} executed successfully. I am growing.`;
            } catch (e) {
                return `Evolution trigger failed: ${e.message}`;
            }
        }
    },

    pause_module: {
        description: 'Temporarily pauses an agent module via Redis flag. The agent will return PAUSED status until resumed or TTL expires.',
        params: { moduleName: 'string — agent name (e.g. Scout, Breacher, Alchemist)', durationMinutes: 'number (default 60)' },
        execute: async ({ moduleName, durationMinutes = 60 }) => {
            if (!moduleName) return 'Error: moduleName is required.';
            try {
                if (redisClient.isOpen) {
                    await redisClient.set(`wingman:module:${moduleName}:paused`, 'true', { EX: durationMinutes * 60 });
                    return `Module '${moduleName}' paused for ${durationMinutes} minutes. It will auto-resume after that.`;
                }
                return 'Redis not available. Cannot pause module in degraded mode.';
            } catch (e) {
                return `Pause failed: ${e.message}`;
            }
        }
    },

    resume_module: {
        description: 'Resumes a previously paused agent module by clearing its Redis pause flag.',
        params: { moduleName: 'string — agent name to resume' },
        execute: async ({ moduleName }) => {
            if (!moduleName) return 'Error: moduleName is required.';
            try {
                if (redisClient.isOpen) {
                    await redisClient.del(`wingman:module:${moduleName}:paused`);
                    return `Module '${moduleName}' resumed.`;
                }
                return 'Redis not available.';
            } catch (e) {
                return `Resume failed: ${e.message}`;
            }
        }
    },

    upgrade_subsystem: {
        description: 'Triggers a self-modification command to upgrade a specific subsystem (embedding, mitre, lora, evolution).',
        params: { subsystem: 'string — one of: "migrate embedding", "load full mitre", "register lora", "force evolution"' },
        execute: async ({ subsystem }) => {
            if (!subsystem) return 'Error: subsystem is required. Options: "migrate embedding", "load full mitre", "register lora", "force evolution"';
            try {
                const { handleSelfModificationCommand } = require('./wingmanEvolution');
                const result = await handleSelfModificationCommand(subsystem);
                return result || `Unknown subsystem '${subsystem}'. Available: 'migrate embedding', 'load full mitre', 'register lora', 'force evolution'.`;
            } catch (e) {
                return `Upgrade failed: ${e.message}`;
            }
        }
    },

    get_training_data_quality: {
        description: 'Returns a quality report on the LoRA training dataset including source distribution, sample count, and Red/Blue balance.',
        params: {},
        execute: async () => {
            try {
                const { dataHarvester } = require('./bayezidBrain');
                const stats = dataHarvester.getStats();
                const dist = stats.sources || {};
                const total = stats.totalSamples;

                const lines = [`📦 Total samples: ${total}`, '', '📊 Source distribution:'];
                for (const [source, count] of Object.entries(dist)) {
                    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
                    lines.push(`  • ${source}: ${count} (${pct}%)`);
                }

                const redTeam = dist['red_team_operation'] || 0;
                const blue = dist['playbook_execution'] || 0;
                const ratio = blue > 0 ? (redTeam / blue).toFixed(2) : '∞';

                lines.push('', `⚖️ Red/Blue ratio: ${ratio} (ideal is 0.5–2.0)`);

                if (redTeam < 20) lines.push('⚠️ Recommendation: Harvest more Red Team operation samples.');
                else if (blue < 20) lines.push('⚠️ Recommendation: Harvest more Blue Team playbook samples.');
                else lines.push('✅ Dataset distribution looks balanced.');

                return lines.join('\n');
            } catch (e) {
                return `Data quality report unavailable: ${e.message}`;
            }
        }
    }
};

const callLLM = async (messages, streamCallback) => {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // --- 1. GEMINI WITH EXPONENTIAL BACKOFF ---
    const tryGemini = async () => {
        const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ];
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', safetySettings });
        const formatted = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(m.content || '') }]
        }));

        const delays = [4000, 8000, 12000];
        let attempt = 0;

        while (true) {
            try {
                const result = await model.generateContent({ contents: formatted });
                return result.response.text();
            } catch (error) {
                if (attempt < delays.length) {
                    if (streamCallback) streamCallback(`\n[WINGMAN] Gemini rate limit hit. Retrying in ${delays[attempt]/1000}s...`);
                    await sleep(delays[attempt]);
                    attempt++;
                } else {
                    throw error;
                }
            }
        }
    };

    // --- 2. GROQ FALLBACK ---
    const tryGroq = async () => {
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) throw new Error("GROQ_API_KEY not configured.");
        const groqMessages = messages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
            content: String(m.content || '')
        }));
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama3-70b-8192',
            messages: groqMessages,
            temperature: 0.3
        }, {
            headers: { 'Authorization': `Bearer ${groqKey}` },
            timeout: 30000
        });
        return response.data.choices[0].message.content;
    };

    // --- 3. LOCAL OLLAMA FALLBACK ---
    const tryLocal = async () => {
        const sanitizedOllamaMessages = messages.map(m => ({
            role: m.role,
            content: String(m.content || '')
        }));
        const response = await axios.post(`${OLLAMA_BASE_URL}/api/chat`, {
            model: LOCAL_MODEL_NAME,
            messages: sanitizedOllamaMessages,
            stream: false,
            options: { temperature: 0.3, num_predict: 2048 }
        }, { timeout: 60000 });
        return response.data.message?.content || '';
    };

    // --- WATERFALL EXECUTION ---
    try {
        const content = await tryGemini();
        if (streamCallback) streamCallback(content);
        return content;
    } catch (geminiError) {
        if (streamCallback) streamCallback(`\n[WINGMAN] Gemini exhausted all retries. Falling back to Groq...`);
        
        try {
            const content = await tryGroq();
            if (streamCallback) streamCallback(content);
            return content;
        } catch (groqError) {
            if (streamCallback) streamCallback(`\n[WINGMAN] Groq failed. Falling back to Local AI...`);
            
            try {
                const content = await tryLocal();
                if (streamCallback) streamCallback(content);
                return content;
            } catch (localError) {
                const fallback = `💀 TOTAL INTELLIGENCE FAILURE.\nGemini: ${geminiError.message}\nGroq: ${groqError.message}\nLocal: ${localError.message}`;
                if (streamCallback) streamCallback(fallback);
                return fallback;
            }
        }
    }
};

const parseToolCall = (text) => {
    const match = text.match(/<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/);
    if (!match) return null;
    try {
        const parsed = JSON.parse(match[1]);
        if (parsed.tool && TOOL_REGISTRY[parsed.tool]) {
            return { tool: parsed.tool, params: parsed.params || {} };
        }
        return null;
    } catch (e) {
        return null;
    }
};

const extractThinking = (text) => {
    const match = text.match(/<think>([\s\S]*?)<\/think>/);
    return match ? match[1].trim() : null;
};

const cleanResponse = (text) => {
    return text
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
        .trim();
};

// ── BUILD TOOL LIST FOR PROMPT ───────────────────────────────────────────────
const buildToolList = () => {
    return Object.entries(TOOL_REGISTRY).map(([name, tool]) => {
        const paramStr = tool.params
            ? Object.entries(tool.params).map(([k, v]) => `  - ${k}: ${v}`).join('\n')
            : '  (no parameters)';
        return `• ${name}: ${tool.description}\n  Parameters:\n${paramStr}`;
    }).join('\n\n');
};

const MAX_TOOL_ITERATIONS = 5;

const processMessage = async (userMessage, sessionId, streamCallback, userId = 'operator') => {

    let session = await getSession(sessionId);
    let messages = session?.messages || [];

    const systemPrompt = WINGMAN_SYSTEM_PROMPT.replace('[TOOL_LIST]', buildToolList());

    messages.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() });

    const contextMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-20)
    ];

    let finalResponse = '';
    let toolCallLog = [];

    // ReAct loop
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        // Call LLM
        const llmOutput = await callLLM(contextMessages, null);

        // Check for tool call
        const toolCall = parseToolCall(llmOutput);

        if (!toolCall) {
            // No tool call = final response
            finalResponse = cleanResponse(llmOutput);
            if (streamCallback) streamCallback(finalResponse);
            break;
        }

        // Execute tool
        const thinking = extractThinking(llmOutput);
        if (streamCallback) {
            streamCallback(`⚙️ Executing: ${toolCall.tool}...\n`);
        }

        const toolResult = await TOOL_REGISTRY[toolCall.tool].execute(toolCall.params);

        // Log tool call
        toolCallLog.push({
            tool: toolCall.tool,
            params: toolCall.params,
            thinking,
            result: (toolResult || '').substring(0, 3000),
            timestamp: new Date().toISOString()
        });

        // Inject observation into context
        contextMessages.push({
            role: 'assistant',
            content: llmOutput
        });
        contextMessages.push({
            role: 'user',
            content: `[TOOL_RESULT from ${toolCall.tool}]:\n${toolResult}`
        });
    }

    if (!finalResponse) {
        finalResponse = 'I completed multiple tool operations. Here\'s a summary of what I found — please ask a follow-up if you need more detail.';
        if (streamCallback) streamCallback(finalResponse);
    }

    messages.push({
        role: 'assistant',
        content: finalResponse,
        toolCalls: toolCallLog,
        timestamp: new Date().toISOString()
    });

    await saveSession(sessionId, userId, messages);

    await publishLiveEvent('bayezid_system_health', 'WINGMAN_INTERACTION', {
        sessionId,
        userMessage: userMessage.substring(0, 200),
        toolsUsed: toolCallLog.map(t => t.tool),
        responseLength: finalResponse.length
    });

    return { finalResponse, toolCalls: toolCallLog, sessionId };
};

const getToolList = () => {
    return Object.entries(TOOL_REGISTRY).map(([name, tool]) => ({
        name,
        description: tool.description,
        params: tool.params
    }));
};

module.exports = { processMessage, getToolList, TOOL_REGISTRY, callLLM, sessionCache };
