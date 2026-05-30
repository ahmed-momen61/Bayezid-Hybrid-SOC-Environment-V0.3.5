const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'telemetry.db');
const db = new sqlite3.Database(dbPath);

const FLUSH_INTERVAL_MS = 500;
const logBuffer = [];
let flushTimer = null;

const initializeDB = () => {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS tactical_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            event TEXT,
            node TEXT,
            details TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS adversarial_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            action TEXT,
            agent TEXT,
            success BOOLEAN,
            details TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS strategic_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            trigger TEXT,
            modifier TEXT,
            details TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS native_sensor_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            topic TEXT,
            source_ip TEXT,
            pid INTEGER,
            process TEXT,
            action TEXT,
            reason TEXT,
            sensor TEXT,
            os TEXT,
            raw_json TEXT
        )`);
    });
};

initializeDB();

const emitTelemetry = (category, payload) => {
    const timestamp = new Date().toISOString();
    const safeDetails = payload.details ? JSON.stringify(payload.details) : '{}';

    if (category === 'TACTICAL') {
        logBuffer.push({
            category,
            timestamp,
            event: payload.event,
            node: payload.node || 'unknown',
            details: safeDetails
        });
    } else if (category === 'ADVERSARIAL') {
        logBuffer.push({
            category,
            timestamp,
            action: payload.action,
            agent: payload.agent || 'unknown',
            success: payload.success ? 1 : 0,
            details: safeDetails
        });
    } else if (category === 'STRATEGIC') {
        logBuffer.push({
            category,
            timestamp,
            trigger: payload.trigger,
            modifier: payload.modifier,
            details: safeDetails
        });
    } else if (category === 'NATIVE') {
        logBuffer.push({
            category,
            timestamp,
            topic: payload.topic || 'UNKNOWN',
            source_ip: payload.source_ip || '',
            pid: payload.pid || 0,
            process: payload.process || '',
            action: payload.action || '',
            reason: payload.reason || '',
            sensor: payload.sensor || '',
            os: payload.os || '',
            raw_json: safeDetails
        });
    }
};

const processBuffer = () => {
    if (logBuffer.length === 0) return;

    const batch = logBuffer.splice(0, logBuffer.length);

    db.serialize(() => {
        const tacticalItems = batch.filter(item => item.category === 'TACTICAL');
        const adversarialItems = batch.filter(item => item.category === 'ADVERSARIAL');
        const strategicItems = batch.filter(item => item.category === 'STRATEGIC');
        const nativeItems = batch.filter(item => item.category === 'NATIVE');

        if (tacticalItems.length > 0) {
            const stmt = db.prepare(`INSERT INTO tactical_log (timestamp, event, node, details) VALUES (?, ?, ?, ?)`);
            tacticalItems.forEach(item => {
                stmt.run(item.timestamp, item.event, item.node, item.details);
            });
            stmt.finalize();
        }

        if (adversarialItems.length > 0) {
            const stmt = db.prepare(`INSERT INTO adversarial_log (timestamp, action, agent, success, details) VALUES (?, ?, ?, ?, ?)`);
            adversarialItems.forEach(item => {
                stmt.run(item.timestamp, item.action, item.agent, item.success, item.details);
            });
            stmt.finalize();
        }

        if (strategicItems.length > 0) {
            const stmt = db.prepare(`INSERT INTO strategic_log (timestamp, trigger, modifier, details) VALUES (?, ?, ?, ?)`);
            strategicItems.forEach(item => {
                stmt.run(item.timestamp, item.trigger, item.modifier, item.details);
            });
            stmt.finalize();
        }

        if (nativeItems.length > 0) {
            const stmt = db.prepare(`INSERT INTO native_sensor_log (timestamp, topic, source_ip, pid, process, action, reason, sensor, os, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            nativeItems.forEach(item => {
                stmt.run(item.timestamp, item.topic, item.source_ip, item.pid, item.process, item.action, item.reason, item.sensor, item.os, item.raw_json);
            });
            stmt.finalize();
        }
    });
};

flushTimer = setInterval(processBuffer, FLUSH_INTERVAL_MS);

const clearDB = () => {
    return new Promise((resolve) => {
        db.serialize(() => {
            db.run(`DELETE FROM tactical_log`);
            db.run(`DELETE FROM adversarial_log`);
            db.run(`DELETE FROM strategic_log`);
            db.run(`DELETE FROM native_sensor_log`);
            resolve();
        });
    });
};

const flushAndClose = () => {
    return new Promise((resolve) => {
        if (flushTimer) {
            clearInterval(flushTimer);
            flushTimer = null;
        }
        processBuffer();
        db.close((err) => {
            if (err) {
                console.error('[-] Telemetry DB close error:', err.message);
            }
            resolve();
        });
    });
};

module.exports = {
    emitTelemetry,
    clearDB,
    flushAndClose
};
