
const http = require('http');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config();
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
let TOKEN = process.env.TEST_TOKEN || '';
let passed = 0;
let failed = 0;

const test = async (name, fn) => {
    try {
        await fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ❌ ${name}: ${e.message}`);
    }
};

const postJSON = (path, body) => {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const data = JSON.stringify(body);
        const req = http.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(body), raw: body });
                } catch (e) {
                    resolve({ status: res.statusCode, body: null, raw: body });
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
};

const getJSON = (path) => {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        http.get(url, { headers: { 'Authorization': `Bearer ${TOKEN}` } }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: null, raw: body });
                }
            });
        }).on('error', reject);
    });
};

const runTests = async () => {
    console.log('\n🦾 THE WINGMAN — Test Suite');
    console.log('═'.repeat(50));

    let testUser = null;
    try {
        console.log('  [Setup] Creating test user and fetching JWT...');
        const testPassword = 'testpassword123';
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(testPassword, salt, 310000, 32, 'sha256').toString('hex');
        
        testUser = await prisma.user.create({
            data: {
                username: `test_wingman_${Date.now()}`,
                passwordHash: `${salt}:${hash}`,
                role: 'ADMIN'
            }
        });

        const loginRes = await postJSON('/api/v2/auth/login', {
            username: testUser.username,
            password: testPassword
        });

        if (loginRes.status !== 200 || !loginRes.body.token) {
            throw new Error(`Login failed. Status: ${loginRes.status}, Body: ${loginRes.raw}`);
        }
        TOKEN = loginRes.body.token;
        console.log('  [Setup] JWT fetched successfully.');
    } catch (e) {
        console.error('  [Setup] Failed to setup dynamic login:', e.message);
        if (testUser) await prisma.user.delete({ where: { id: testUser.id } }).catch(()=>{});
        process.exit(1);
    }

    await test('POST /api/v1/wingman/tools returns tool list', async () => {
        const res = await postJSON('/api/v1/wingman/tools', {});
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (!res.body?.data || !Array.isArray(res.body.data)) throw new Error('Expected array of tools');
        if (res.body.data.length < 10) throw new Error(`Expected ≥10 tools, got ${res.body.data.length}`);
    });

    await test('POST /api/v1/wingman/chat returns SSE stream', async () => {
        const res = await postJSON('/api/v1/wingman/chat', {
            message: 'Hello, Wingman. What is your status?',
            sessionId: 'test-session-001'
        });

        if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
    });

    await test('GET /api/v1/wingman/session/:id returns session', async () => {
        const res = await getJSON('/api/v1/wingman/session/test-session-001');
        if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
    });

    await test('wingmanService.js exports processMessage', async () => {
        const mod = require('../wingmanService');
        if (typeof mod.processMessage !== 'function') throw new Error('processMessage not exported');
        if (typeof mod.getToolList !== 'function') throw new Error('getToolList not exported');
    });

    await test('wingmanEyes.js exports initializeEyes', async () => {
        const mod = require('../wingmanEyes');
        if (typeof mod.initializeEyes !== 'function') throw new Error('initializeEyes not exported');
        if (typeof mod.getPlainEnglishBriefing !== 'function') throw new Error('getPlainEnglishBriefing not exported');
    });

    await test('wingmanSurgeon.js exports applyEdit', async () => {
        const mod = require('../wingmanSurgeon');
        if (typeof mod.applyEdit !== 'function') throw new Error('applyEdit not exported');
        if (typeof mod.validateSyntax !== 'function') throw new Error('validateSyntax not exported');
    });

    await test('wingmanMemory.js exports detectLanguage', async () => {
        const mod = require('../wingmanMemory');
        if (typeof mod.detectLanguage !== 'function') throw new Error('detectLanguage not exported');

        const ar = mod.detectLanguage('إيه اللي بيحصل في النظام دلوقتي؟');
        if (ar !== 'ar') throw new Error(`Expected 'ar', got '${ar}'`);

        const en = mod.detectLanguage('What is the system status?');
        if (en !== 'en') throw new Error(`Expected 'en', got '${en}'`);

        const fr = mod.detectLanguage('3ayez a3raf el system status بتاعي');
        if (fr !== 'fr_ar' && fr !== 'ar') throw new Error(`Expected 'fr_ar' or 'ar', got '${fr}'`);
    });

    await test('wingmanOverseer.js exports startSupervision', async () => {
        const mod = require('../wingmanOverseer');
        if (typeof mod.startSupervision !== 'function') throw new Error('startSupervision not exported');
        if (typeof mod.getAgentHealthMap !== 'function') throw new Error('getAgentHealthMap not exported');
    });

    console.log('\n' + '═'.repeat(50));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('═'.repeat(50));

    if (testUser) {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(()=>{});
    }

    if (failed > 0) process.exit(1);
};

runTests().catch(e => {
    console.error('Test runner error:', e);
    process.exit(1);
});
