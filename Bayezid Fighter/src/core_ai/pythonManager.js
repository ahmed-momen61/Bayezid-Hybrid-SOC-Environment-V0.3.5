const os = require('os');
const { spawn } = require('child_process');
const path = require('path');

const daemons = {
    causalEngine: { script: 'ml_engine/causal_engine.py', process: null, name: 'Causal Engine', port: 8002 },
    mlSniper: { script: 'ml_engine/main.py', process: null, name: 'ML Sniper', port: 8000 },
    gnnOracle: { script: 'ml_engine/gnn_oracle.py', process: null, name: 'GNN Oracle', port: 8001 },
    llvmMutator: { script: 'ml_engine/llvm_mutator.py', process: null, name: 'LLVM Mutator', port: 8003 }
};

let currentDelay = 1000;
const MAX_DELAY = 30000;
let isShuttingDown = false;
let currentExecutable = os.platform() === 'win32' ? 'py' : 'python3';
const win32Fallbacks = ['py', 'python', 'python3'];
let win32FallbackIdx = 0;

const spawnDaemon = (key) => {
    const daemon = daemons[key];
    if (!daemon || daemon.process) {
        return;
    }
    
    const scriptPath = path.join(__dirname, '../../', daemon.script);
    
    if (os.platform() === 'win32') {
        console.log(`[🐍] Spawning ${daemon.name} in a popped-up terminal window on port ${daemon.port}...`);
        const winScript = daemon.script.replace(/\//g, '\\');
        daemon.process = spawn('powershell.exe', [
            '-NoProfile', '-NonInteractive', '-Command',
            `Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "title ${daemon.name} && ${currentExecutable} ${winScript}" -Wait`
        ], {
            cwd: path.join(__dirname, '../../')
        });
    } else {
        console.log(`[🐍] Starting ${daemon.name} daemon on port ${daemon.port}: ${currentExecutable} ${scriptPath}`);
        daemon.process = spawn(currentExecutable, [scriptPath], {
            stdio: 'inherit',
            cwd: path.join(__dirname, '../../')
        });
    }
    
    daemon.process.on('error', (err) => {
        console.error(`[🐍] ${daemon.name} spawn error (${currentExecutable}):`, err.message);
        
        if (os.platform() === 'win32' && err.code === 'ENOENT' && win32FallbackIdx < win32Fallbacks.length - 1) {
            win32FallbackIdx++;
            currentExecutable = win32Fallbacks[win32FallbackIdx];
            console.log(`[🐍] Retrying on Windows with fallback executable: ${currentExecutable}`);
            daemon.process = null;
            spawnDaemon(key);
            return;
        }
        
        daemon.process = null;
        if (!isShuttingDown) {
            setTimeout(() => spawnDaemon(key), 5000);
        }
    });
    
    daemon.process.on('close', (code) => {
        daemon.process = null;
        if (!isShuttingDown) {
            console.warn(`[🐍] ${daemon.name} daemon window was closed or exited with code ${code}. Restarting in 5s...`);
            setTimeout(() => spawnDaemon(key), 5000);
        }
    });
};

const spawnCausalEngine = () => {
    isShuttingDown = false;
    for (const key of Object.keys(daemons)) {
        spawnDaemon(key);
    }
};

const getCausalEngineStatus = () => {
    const status = {};
    for (const [key, daemon] of Object.entries(daemons)) {
        status[key] = {
            running: daemon.process !== null,
            pid: daemon.process ? daemon.process.pid : null,
            name: daemon.name,
            port: daemon.port
        };
    }
    return status;
};

const stopCausalEngine = () => {
    isShuttingDown = true;
    for (const [key, daemon] of Object.entries(daemons)) {
        if (daemon.process) {
            console.log(`[🐍] Stopping ${daemon.name} daemon...`);
            daemon.process.kill();
            daemon.process = null;
            if (os.platform() === 'win32') {
                try {
                    const { exec } = require('child_process');
                    exec(`taskkill /F /FI "WINDOWTITLE eq ${daemon.name}*"`, () => {});
                } catch (e) {}
            }
        }
    }
};

module.exports = {
    spawnCausalEngine,
    getCausalEngineStatus,
    stopCausalEngine
};
