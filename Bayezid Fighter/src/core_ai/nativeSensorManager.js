const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const platform = os.platform();
const sensors = [];
let isShuttingDown = false;

const spawnSensor = (name, executablePath, args = []) => {
    console.log(`[⚙️] NATIVE SENSOR MANAGER: Spawning ${name}...`);
    
    try {
        const proc = spawn(executablePath, args, { stdio: 'pipe' });
        
        proc.stdout.on('data', (data) => {
            console.log(`[${name} STDOUT]: ${data.toString().trim()}`);
        });

        proc.stderr.on('data', (data) => {
            console.error(`[${name} STDERR]: ${data.toString().trim()}`);
        });

        proc.on('close', (code) => {
            console.log(`[⚙️] NATIVE SENSOR MANAGER: ${name} exited with code ${code}`);
            if (!isShuttingDown) {
                console.log(`[⚙️] Restarting ${name} in 3 seconds...`);
                setTimeout(() => spawnSensor(name, executablePath, args), 3000);
            }
        });

        sensors.push(proc);
        return proc;
    } catch (e) {
        console.error(`[⚙️] NATIVE SENSOR MANAGER: Failed to spawn ${name}: ${e.message}`);
    }
};

const startNativeSensors = () => {
    isShuttingDown = false;
    const baseDir = path.join(__dirname, '../../native');

    if (platform === 'linux') {
        spawnSensor('xdp_telemetry_relay', path.join(baseDir, 'linux/build/xdp_telemetry_relay'));
        spawnSensor('mem_scanner_linux', path.join(baseDir, 'linux/build/mem_scanner_linux'));
        spawnSensor('syscall_relay', path.join(baseDir, 'linux/build/syscall_relay'));
    } else if (platform === 'win32') {
        spawnSensor('wfp_striker', path.join(baseDir, 'windows/build/wfp_striker.exe'));
        spawnSensor('mem_scanner_win', path.join(baseDir, 'windows/build/mem_scanner_win.exe'));
        spawnSensor('etw_monitor', path.join(baseDir, 'windows/build/etw_monitor.exe'));
    } else {
        console.warn(`[⚙️] NATIVE SENSOR MANAGER: OS ${platform} not supported for native sensors.`);
    }
};

const stopNativeSensors = () => {
    isShuttingDown = true;
    console.log(`[⚙️] NATIVE SENSOR MANAGER: Shutting down ${sensors.length} native sensors...`);
    for (const proc of sensors) {
        if (!proc.killed) {
            proc.kill('SIGINT');
            setTimeout(() => {
                if (!proc.killed) proc.kill('SIGKILL');
            }, 2000);
        }
    }
    sensors.length = 0;
};

module.exports = {
    startNativeSensors,
    stopNativeSensors
};
