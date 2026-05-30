const os = require('os');
const { spawn } = require('child_process');
const path = require('path');

const daemons = {
    causalEngine: { script: 'ml_engine/causal_engine.py', process: null, name: 'Causal Engine', port: 8002 },
    mlSniper: { script: 'ml_engine/main.py', process: null, name: 'ML Sniper', port: 8000 },
    gnnOracle: { script: 'ml_engine/gnn_oracle.py', process: null, name: 'GNN Oracle', port: 8001 },
    llvmMutator: { script: 'ml_engine/llvm_mutator.py', process: null, name: 'LLVM Mutator', port: 8003 },
    mispDocker: { isDocker: true, cmd: 'docker-compose -f misp-local/docker-compose.yml up', process: null, name: 'MISP Server', port: 8088 }
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
    
    if (os.platform() === 'win32') {
        console.log(`[🚀] Spawning ${daemon.name} in a popped-up terminal window on port ${daemon.port}...`);
        let execCmd = '';
        if (daemon.isDocker) {
            execCmd = daemon.cmd.replace(/\//g, '\\');
        } else {
            const winScript = daemon.script.replace(/\//g, '\\');
            execCmd = `${currentExecutable} ${winScript}`;
        }
        
        daemon.process = spawn('powershell.exe', [
            '-NoProfile', '-NonInteractive', '-Command',
            `Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "title ${daemon.name} && ${execCmd}" -Wait`
        ], {
            cwd: path.join(__dirname, '../../')
        });
    } else {
        if (daemon.isDocker) {
            console.log(`[🐳] Starting ${daemon.name} daemon via Docker on port ${daemon.port}...`);
            const args = daemon.cmd.split(' ');
            daemon.process = spawn(args[0], args.slice(1), {
                stdio: 'inherit',
                cwd: path.join(__dirname, '../../')
            });
        } else {
            const scriptPath = path.join(__dirname, '../../', daemon.script);
            console.log(`[🐍] Starting ${daemon.name} daemon on port ${daemon.port}: ${currentExecutable} ${scriptPath}`);
            daemon.process = spawn(currentExecutable, [scriptPath], {
                stdio: 'inherit',
                cwd: path.join(__dirname, '../../')
            });
        }
    }
    
    daemon.process.on('error', (err) => {
        console.error(`[🚀] ${daemon.name} spawn error:`, err.message);
        
        if (!daemon.isDocker && os.platform() === 'win32' && err.code === 'ENOENT' && win32FallbackIdx < win32Fallbacks.length - 1) {
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
            console.warn(`[🚀] ${daemon.name} daemon window was closed or exited with code ${code}. Restarting in 5s...`);
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
        console.log(`[🚀] Stopping ${daemon.name} daemon...`);
        if (daemon.process) {
            daemon.process.kill();
            daemon.process = null;
        }
        if (daemon.isDocker) {
            try {
                const { execSync } = require('child_process');
                execSync('docker-compose -f misp-local/docker-compose.yml down', { stdio: 'ignore' });
            } catch (e) {}
        }
        if (os.platform() === 'win32') {
            try {
                const { execSync } = require('child_process');
                // Kill popped-up terminal window by title matching (exact and wildcard)
                execSync(`taskkill /F /FI "WINDOWTITLE eq ${daemon.name}"`, { stdio: 'ignore' });
                execSync(`taskkill /F /FI "WINDOWTITLE eq ${daemon.name}*"`, { stdio: 'ignore' });
                
                // Kill python script process by command line matching to prevent leaks
                if (!daemon.isDocker && daemon.script) {
                    const escapedScript = daemon.script.replace(/\//g, '\\\\');
                    execSync(`powershell.exe -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${escapedScript}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`, { stdio: 'ignore' });
                }
            } catch (e) {}
        }
    }
};

module.exports = {
    spawnCausalEngine,
    getCausalEngineStatus,
    stopCausalEngine
};
