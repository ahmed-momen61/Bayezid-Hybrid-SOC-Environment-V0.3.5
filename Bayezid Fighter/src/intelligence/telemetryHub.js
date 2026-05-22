const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../../data/telemetry.db');
const db = new sqlite3.Database(dbPath);

/**
 * Initializes the SQLite database and creates the required schemas if they don't exist.
 */
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
    });
};

initializeDB();

/**
 * Pushes structured telemetry payloads to the centralized SQLite database.
 * @param {string} category - 'TACTICAL', 'ADVERSARIAL', or 'STRATEGIC'
 * @param {object} payload - The structured JSON data.
 */
const emitTelemetry = (category, payload) => {
    const timestamp = new Date().toISOString();
    
    // Convert complex nested objects to strings to prevent object [Object] in DB
    const safeDetails = payload.details ? JSON.stringify(payload.details) : '{}';

    if (category === 'TACTICAL') {
        const stmt = db.prepare(`INSERT INTO tactical_log (timestamp, event, node, details) VALUES (?, ?, ?, ?)`);
        stmt.run(timestamp, payload.event, payload.node || 'unknown', safeDetails);
        stmt.finalize();
    } else if (category === 'ADVERSARIAL') {
        const stmt = db.prepare(`INSERT INTO adversarial_log (timestamp, action, agent, success, details) VALUES (?, ?, ?, ?, ?)`);
        stmt.run(timestamp, payload.action, payload.agent || 'unknown', payload.success ? 1 : 0, safeDetails);
        stmt.finalize();
    } else if (category === 'STRATEGIC') {
        const stmt = db.prepare(`INSERT INTO strategic_log (timestamp, trigger, modifier, details) VALUES (?, ?, ?, ?)`);
        stmt.run(timestamp, payload.trigger, payload.modifier, safeDetails);
        stmt.finalize();
    }
};

/**
 * Clear DB before starting a new test run.
 */
const clearDB = () => {
    return new Promise((resolve) => {
        db.serialize(() => {
            db.run(`DELETE FROM tactical_log`);
            db.run(`DELETE FROM adversarial_log`);
            db.run(`DELETE FROM strategic_log`);
            resolve();
        });
    });
};

module.exports = {
    emitTelemetry,
    clearDB
};
