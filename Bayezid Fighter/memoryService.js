const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const { IndexFlatL2 } = require('faiss-node');
const { createClient } = require('redis');

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: { reconnectStrategy: false }
});
redisClient.on('error', (err) => {
    if (err && err.code === 'ECONNREFUSED') return;
    console.error('[-] Redis Live-Bus Error:', err);
});
(async() => {
    try {
        try {
            require('child_process').execSync('docker start bayezid-redis', { stdio: 'ignore' });
        } catch (e) {}
        await redisClient.connect();
        console.log(`[⚡] Live-Stream Memory Bus (Redis) Active.`);
    } catch (err) {
        console.log(`[⚠️] Redis Live-Bus Offline: Running in degraded mode without pub/sub.`);
    }
})();

const dimension = 768;
const faissIndex = new IndexFlatL2(dimension);
const memoryRegistry = new Map();
let faissCounter = 0;

const publishLiveEvent = async(channel, eventType, payload) => {
    try {
        const message = JSON.stringify({ type: eventType, timestamp: Date.now(), data: payload });
        await redisClient.publish(channel, message);
    } catch (e) {
        console.error("[-] Redis Publish Error:", e.message);
    }
};

const generateEmbedding = async(text) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
        const result = await model.embedContent(text);

        if (result && result.embedding && result.embedding.values) {
            return result.embedding.values;
        }
        return null;
    } catch (error) {
        console.error("[-] Embedding Error, trying fallback:", error.message);
        try {
            const fallbackModel = genAI.getGenerativeModel({ model: "embedding-001" });
            const result = await fallbackModel.embedContent(text);
            return result.embedding.values;
        } catch (fallbackError) {
            console.error("[-] Fallback also failed:", fallbackError.message);
            return null;
        }
    }
};

const findSimilarIncidents = async(logData) => {
    console.log(`[🧠] Searching In-Memory FAISS Cache for similar attack patterns...`);
    const vector = await generateEmbedding(logData);

    if (!vector || !Array.isArray(vector) || faissIndex.ntotal() === 0) return null;

    try {
        const results = faissIndex.search(vector, 1);

        if (results && results.distances && results.distances.length > 0) {
            const distance = results.distances[0];
            const similarity = Math.max(0, 1 - (distance / 100));

            if (similarity >= 0.85) {
                const matchedId = results.labels[0];
                return memoryRegistry.get(matchedId);
            }
        }
        return null;
    } catch (error) {
        console.error("[-] FAISS Search Error:", error.message);
        return null;
    }
};

const saveIncidentToMemory = async(alertId, logData) => {
    const vector = await generateEmbedding(logData);
    if (!vector) return;

    try {
        faissIndex.add(vector);
        memoryRegistry.set(faissCounter, { id: alertId, payload: logData });
        faissCounter++;

        console.log(`[💾] Alert ${alertId} embedded into FAISS Semantic Cache (Zero I/O Latency).`);

        await publishLiveEvent('bayezid_tactical_feed', 'NEW_THREAT_EMBEDDED', { alertId, logData });

    } catch (error) {
        console.error("[-] Memory/FAISS Cache Error:", error.message);
    }
};

module.exports = { findSimilarIncidents, saveIncidentToMemory, publishLiveEvent, redisClient };