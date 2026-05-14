const { exec } = require('child_process');
const os = require('os');

const ttlRegistry = new Map();
const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000;

const platform = os.platform();

const ipToHex = (ip) => {
    return ip.split('.')
        .map(octet => parseInt(octet, 10).toString(16).padStart(2, '0'))
        .join(' ');
};

const KernelStriker = {
    blockIp: (ip) => {
        if (ttlRegistry.has(ip)) return;

        let cmd = '';

        if (platform === 'linux') {
            const hexIp = ipToHex(ip);
            cmd = `sudo bpftool map update name blocklist key hex ${hexIp} value hex 01 00 00 00`;
        } else if (platform === 'win32') {
            cmd = `powershell.exe -Command "New-NetFirewallRule -DisplayName 'Bayezid_Drop_${ip}' -Direction Inbound -Action Block -RemoteAddress ${ip}"`;
        } else {
            console.log(`[⚠️] OS '${platform}' not fully supported for Kernel Striker yet.`);
            return;
        }

        exec(cmd, (err) => {
            if (err) {
                console.error(`[⚠️] Striker Error blocking ${ip} on ${platform}:`, err.message);
                return;
            }
            console.log(`[☠️] OS Striker: IP ${ip} eradicated at Network Layer L3 (${platform.toUpperCase()}).`);

            ttlRegistry.set(ip, Date.now());
        });
    },

    unblockIp: (ip) => {
        let cmd = '';

        if (platform === 'linux') {
            const hexIp = ipToHex(ip);
            cmd = `sudo bpftool map delete name blocklist key hex ${hexIp}`;
        } else if (platform === 'win32') {
            cmd = `powershell.exe -Command "Remove-NetFirewallRule -DisplayName 'Bayezid_Drop_${ip}'"`;
        }

        exec(cmd, (err) => {
            if (!err) {
                console.log(`[♻️] OS Striker: IP ${ip} unblocked. TTL expired.`);
                ttlRegistry.delete(ip);
            }
        });
    },

    startTtlDaemon: () => {
        setInterval(() => {
            const now = Date.now();
            for (const [ip, timestamp] of ttlRegistry.entries()) {
                if (now - timestamp >= BLOCK_DURATION_MS) {
                    KernelStriker.unblockIp(ip);
                }
            }
        }, 60 * 60 * 1000);
        console.log(`[🛡️] OS-Agnostic Striker TTL Daemon initialized on [${platform.toUpperCase()}].`);
    }
};

module.exports = KernelStriker;