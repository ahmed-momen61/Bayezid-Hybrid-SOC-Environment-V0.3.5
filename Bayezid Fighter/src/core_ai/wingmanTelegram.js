
const { Telegraf } = require('telegraf');
const { processMessage } = require('./wingmanService');
const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.WINGMAN_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.WINGMAN_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

let bot = null;
let botActive = false;

const MAX_TELEGRAM_MSG = 4000;

const splitMessage = (text) => {
    if (text.length <= MAX_TELEGRAM_MSG) return [text];
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
        let chunk = remaining.substring(0, MAX_TELEGRAM_MSG);

        const lastNewline = chunk.lastIndexOf('\n');
        if (lastNewline > MAX_TELEGRAM_MSG * 0.5) {
            chunk = remaining.substring(0, lastNewline);
        }
        chunks.push(chunk);
        remaining = remaining.substring(chunk.length);
    }
    return chunks;
};

const escapeHTML = (text) => {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const setupCommands = (bot) => {

    bot.use(async (ctx, next) => {
        const adminChatId = process.env.WINGMAN_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
        if (ctx.chat && ctx.chat.id.toString() !== adminChatId) {
            console.log(`[⚠️] Unauthorized access attempt from Chat ID: ${ctx.chat.id}`);

            return;
        }
        return next();
    });

    bot.command('start', async (ctx) => {
        await ctx.replyWithHTML(
            `🦾 <b>THE WINGMAN — Bayezid SOC Copilot</b>\n\n` +
            `I'm your omniscient AI partner for the Bayezid Hybrid SOC.\n\n` +
            `<b>Commands:</b>\n` +
            `/status — System health briefing\n` +
            `/alerts [n] — Last n alerts\n` +
            `/supervise [agent] — Agent event history\n` +
            `/block [ip] — Block an IP via KernelStriker\n` +
            `/approve [id] — Approve pending operation\n` +
            `/deny [id] — Deny pending operation\n` +
            `/train — Force LoRA training cycle\n` +
            `/lora_status — LoRA training metrics\n` +
            `/brief — Full system briefing\n\n` +
            `Or just send me any question — I understand natural language. 🧠`
        );
    });

    bot.command('status', async (ctx) => {
        const sessionId = `telegram_${ctx.chat.id}_status`;
        let response = '';
        try {
            const result = await processMessage('Give me a quick system status summary', sessionId, (t) => response += t, 'telegram_operator');
            response = result.finalResponse || response;
        } catch (e) {
            response = `⚠️ Error getting status: ${e.message}`;
        }
        for (const chunk of splitMessage(response)) {
            await ctx.reply(chunk);
        }
    });

    bot.command('alerts', async (ctx) => {
        const args = ctx.message.text.split(' ');
        const n = parseInt(args[1]) || 5;
        const sessionId = `telegram_${ctx.chat.id}_alerts`;
        let response = '';
        try {
            const result = await processMessage(`Show me the last ${n} alerts with their severity and status`, sessionId, (t) => response += t, 'telegram_operator');
            response = result.finalResponse || response;
        } catch (e) {
            response = `⚠️ Error: ${e.message}`;
        }
        for (const chunk of splitMessage(response)) {
            await ctx.reply(chunk);
        }
    });

    bot.command('supervise', async (ctx) => {
        const agent = ctx.message.text.split(' ').slice(1).join(' ');
        if (!agent) return ctx.reply('Usage: /supervise <agent_name_or_target_ip>');
        const sessionId = `telegram_${ctx.chat.id}_supervise`;
        let response = '';
        try {
            const result = await processMessage(`Supervise agent/target ${agent} and show me its recent events`, sessionId, (t) => response += t, 'telegram_operator');
            response = result.finalResponse || response;
        } catch (e) {
            response = `⚠️ Error: ${e.message}`;
        }
        for (const chunk of splitMessage(response)) {
            await ctx.reply(chunk);
        }
    });

    bot.command('block', async (ctx) => {
        const ip = ctx.message.text.split(' ')[1];
        if (!ip) return ctx.reply('Usage: /block <ip_address>');

        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(ip)) return ctx.reply('❌ Invalid IP format.');

        await ctx.replyWithHTML(
            `⚠️ About to block <code>${escapeHTML(ip)}</code> at the OS level via KernelStriker.\n\n<b>Confirm?</b>`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔴 EXECUTE BLOCK', callback_data: `confirm_block_${ip}` },
                        { text: '❌ Cancel', callback_data: 'cancel_action' }
                    ]]
                }
            }
        );
    });

    bot.command('approve', async (ctx) => {
        const operationId = ctx.message.text.split(' ')[1];
        if (!operationId) return ctx.reply('Usage: /approve <operationId>');
        if (global.io) {
            global.io.of('/wingman').emit('operation_approved_telegram', {
                operationId,
                approvedBy: 'TELEGRAM_OPERATOR',
                timestamp: new Date().toISOString()
            });
        }
        await ctx.replyWithHTML(`✅ Operation <code>${escapeHTML(operationId)}</code> approved via Telegram.`);
    });

    bot.command('deny', async (ctx) => {
        const operationId = ctx.message.text.split(' ')[1];
        if (!operationId) return ctx.reply('Usage: /deny <operationId>');
        if (global.io) {
            global.io.of('/wingman').emit('operation_denied_telegram', {
                operationId,
                deniedBy: 'TELEGRAM_OPERATOR',
                timestamp: new Date().toISOString()
            });
        }
        await ctx.replyWithHTML(`❌ Operation <code>${escapeHTML(operationId)}</code> denied via Telegram.`);
    });

    bot.command('train', async (ctx) => {
        const sessionId = `telegram_${ctx.chat.id}_train`;
        let response = '';
        try {
            const result = await processMessage('Force a LoRA training cycle now', sessionId, (t) => response += t, 'telegram_operator');
            response = result.finalResponse || response;
        } catch (e) {
            response = `⚠️ Error: ${e.message}`;
        }
        await ctx.reply(response);
    });

    bot.command('lora_status', async (ctx) => {
        const sessionId = `telegram_${ctx.chat.id}_lora`;
        let response = '';
        try {
            const result = await processMessage('What is the current LoRA training status and metrics?', sessionId, (t) => response += t, 'telegram_operator');
            response = result.finalResponse || response;
        } catch (e) {
            response = `⚠️ Error: ${e.message}`;
        }
        for (const chunk of splitMessage(response)) {
            await ctx.reply(chunk);
        }
    });

    bot.command('brief', async (ctx) => {
        const sessionId = `telegram_${ctx.chat.id}_brief`;
        let response = '';
        try {
            const result = await processMessage('Give me a comprehensive system briefing covering health, alerts, active operations, LoRA status, and any recent notable events', sessionId, (t) => response += t, 'telegram_operator');
            response = result.finalResponse || response;
        } catch (e) {
            response = `⚠️ Error: ${e.message}`;
        }
        for (const chunk of splitMessage(response)) {
            await ctx.reply(chunk);
        }
    });

    bot.on('text', async (ctx) => {
        const message = ctx.message.text;
        const chatId = ctx.chat.id.toString();
        const sessionId = `telegram_${chatId}_chat`;

        await ctx.sendChatAction('typing');

        let response = '';
        try {
            const result = await processMessage(message, sessionId, (t) => response += t, 'telegram_operator');
            response = result.finalResponse || response;
        } catch (e) {
            response = `⚠️ Error processing your request: ${e.message}`;
        }

        for (const chunk of splitMessage(response || 'I processed your request but generated no output.')) {
            await ctx.reply(chunk);
        }
    });

    bot.on('callback_query', async (ctx) => {
        const data = ctx.callbackQuery.data;

        if (data.startsWith('confirm_block_')) {
            const ip = data.replace('confirm_block_', '');
            try {
                const { KernelStriker } = require('../blue_swarm/kernelStriker');
                const striker = new KernelStriker();
                await striker.blockIp(ip);
                await ctx.editMessageText(`✅ IP <code>${escapeHTML(ip)}</code> blocked at OS level via KernelStriker.`, { parse_mode: 'HTML' });
            } catch (e) {
                await ctx.editMessageText(`❌ Block failed: ${e.message}`);
            }
        } else if (data.startsWith('wingman_analyze_')) {
            const alertId = data.replace('wingman_analyze_', '');
            const sessionId = `telegram_callback_${ctx.chat.id}`;
            let response = '';
            try {
                const result = await processMessage(`Analyze alert ${alertId} in full detail`, sessionId, (t) => response += t, 'telegram_operator');
                response = result.finalResponse || response;
            } catch (e) {
                response = `Error: ${e.message}`;
            }
            for (const chunk of splitMessage(response).slice(0, 3)) {
                await ctx.reply(chunk);
            }
        } else if (data.startsWith('wingman_playbook_')) {
            const alertId = data.replace('wingman_playbook_', '');
            const sessionId = `telegram_callback_${ctx.chat.id}`;
            let response = '';
            try {
                const result = await processMessage(`Execute the remediation playbook for alert ${alertId}`, sessionId, (t) => response += t, 'telegram_operator');
                response = result.finalResponse || response;
            } catch (e) {
                response = `Error: ${e.message}`;
            }
            await ctx.reply(response.substring(0, MAX_TELEGRAM_MSG));
        } else if (data.startsWith('wingman_block_')) {
            const ip = data.replace('wingman_block_', '');
            try {
                const { KernelStriker } = require('../blue_swarm/kernelStriker');
                const striker = new KernelStriker();
                await striker.blockIp(ip);
                await ctx.reply(`✅ IP ${ip} blocked.`);
            } catch (e) {
                await ctx.reply(`❌ Block failed: ${e.message}`);
            }
        } else if (data === 'cancel_action') {
            await ctx.editMessageText('❌ Operation cancelled.');
        } else if (data.startsWith('approve_evolution_')) {
            const targetPhase = data.replace('approve_evolution_', '');
            try {
                const { executePhaseTransition, checkEvolutionReadiness } = require('./wingmanEvolution');
                const readiness = await checkEvolutionReadiness();
                if (!readiness.ready) {
                    await ctx.editMessageText('❌ Evolution conditions no longer met. State may have changed.');
                } else {
                    await ctx.editMessageText(`🚀 <b>EVOLUTION APPROVED</b>\n\nTransition to <b>${targetPhase}</b> executing...`, { parse_mode: 'HTML' });
                    await executePhaseTransition(targetPhase, 'telegram_approve', null);
                    await ctx.reply(`✅ Evolution to <b>${targetPhase}</b> complete. I am growing.`, { parse_mode: 'HTML' });
                }
            } catch (e) {
                await ctx.reply(`❌ Evolution failed: ${e.message}`);
            }
        } else if (data === 'evolution_defer') {
            await ctx.editMessageText('⏳ Evolution deferred. I will ask again when conditions are still met.');
        }

        try { await ctx.answerCbQuery(); } catch (e) {  }
    });
};

const sendProactiveAlert = async (message, keyboard = null) => {
    const chatId = TELEGRAM_CHAT_ID;
    if (!chatId) return;

    const token = TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const opts = { chat_id: chatId, text: message, parse_mode: 'HTML' };
    if (keyboard) opts.reply_markup = { inline_keyboard: keyboard };

    try {
        if (bot && botActive) {
            await bot.telegram.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {})
            });
        } else {

            await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, opts);
        }
    } catch (e) {
        console.error('[-] Telegram proactive alert failed:', e.message);
    }
};

const sendEnhancedAlert = async (alertData, osintData) => {
    const ip = alertData.extracted_ip || alertData.sourceIp || 'Unknown';
    const alertId = alertData.id || alertData.alertId || 'N/A';

    const message = `🚨 <b>BAYEZID SOC ALERT</b> 🚨\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🔴 <b>Severity:</b> ${alertData.severity || 'UNKNOWN'}\n` +
        `🎯 <b>Threat:</b> ${alertData.threat_type || alertData.eventType || 'Unknown'}\n` +
        `🌐 <b>Source IP:</b> <code>${ip}</code>\n` +
        `🌍 <b>Origin:</b> ${osintData?.country || 'Unknown'}\n` +
        `📊 <b>CVSS:</b> ${alertData.cvss_score || 'N/A'}\n` +
        `🤖 <b>Confidence:</b> ${alertData.confidence_score || 'N/A'}\n\n` +
        `📝 <b>Report:</b>\n<i>${(alertData.detailed_report || alertData.report || 'No details').substring(0, 500)}</i>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚙️ <i>Engine: ${alertData.engine_used || 'Bayezid AI'}</i>`;

    const keyboard = [
        [
            { text: '🔍 Full Analysis', callback_data: `wingman_analyze_${alertId}` },
            { text: '⚡ Run Playbook', callback_data: `wingman_playbook_${alertId}` }
        ],
        [
            { text: '⛔ Block IP', callback_data: `wingman_block_${ip}` },
            { text: '✅ False Positive', callback_data: 'cancel_action' }
        ]
    ];

    await sendProactiveAlert(message, keyboard);
};

const startTelegramBot = () => {
    if (!TELEGRAM_BOT_TOKEN) {
        console.log('[📱] Telegram Bot Token not set. Wingman Telegram disabled.');
        return;
    }

    bot = new Telegraf(TELEGRAM_BOT_TOKEN);
    setupCommands(bot);

    bot.launch().then(() => {
        botActive = true;
        console.log('[📱] Wingman Telegram Bot launched and listening.');
    }).catch(e => {
        console.error('[📱] Telegram Bot launch failed:', e.message);
    });

    process.once('SIGINT', () => { if (bot) bot.stop('SIGINT'); });
    process.once('SIGTERM', () => { if (bot) bot.stop('SIGTERM'); });
};

const stopTelegramBot = () => {
    if (bot) {
        bot.stop();
        botActive = false;
    }
};

module.exports = {
    startTelegramBot,
    stopTelegramBot,
    sendProactiveAlert,
    sendEnhancedAlert,
    bot: () => bot
};
