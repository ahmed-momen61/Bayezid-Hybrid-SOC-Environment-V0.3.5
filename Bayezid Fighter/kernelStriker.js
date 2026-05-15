const { exec } = require('child_process');
const os = require('os');
const axios = require('axios');
const util = require('util');
const execPromise = util.promisify(exec);

const ttlRegistry = new Map();
const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000;

const platform = os.platform();

const ipToHex = (ip) => {
    return ip.split('.')
        .map(octet => parseInt(octet, 10).toString(16).padStart(2, '0'))
        .join(' ');
};

const withTimeout = (promise, ms) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Recon Timeout')), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

const traceAttacker = async(ip) => {
    console.log(`\n[🔍] COUNTER-RECON: Initiating Reverse OSINT on ${ip}...`);

    const geoPromise = axios.get(`http://ip-api.com/json/${ip}?fields=status,country,city,isp,as,proxy`)
        .then(res => res.data)
        .catch(() => ({ status: 'fail', error: 'GeoIP Failed' }));

    const nmapCommand = `nmap -Pn -F -T4 ${ip}`;
    const nmapPromise = execPromise(nmapCommand)
        .then(res => res.stdout.trim())
        .catch(err => `Nmap failed or not installed. Err: ${err.message.split('\n')[0]}`);

    try {
        const [geoData, nmapData] = await withTimeout(Promise.all([geoPromise, nmapPromise]), 60000);
        return { geoData, nmapData };
    } catch (e) {
        console.log(`[⚠️] Counter-Recon Warning: ${e.message}`);
        return { geoData: { country: 'Unknown', city: 'Unknown', isp: 'Unknown' }, nmapData: 'Scan timed out' };
    }
};

const KernelStriker = {
    blockIp: async(ip) => {
        if (ttlRegistry.has(ip)) return { geoData: { country: 'Already Blocked', city: '', isp: '' }, nmapData: '' };

        let intel = null;
        if (ip !== '127.0.0.1' && ip !== '::ffff:127.0.0.1' && ip !== 'localhost') {
            intel = await traceAttacker(ip);
            console.log(`[📊] INTEL REPORT: Attacker is from [${intel.geoData.city}, ${intel.geoData.country}]. ISP: ${intel.geoData.isp}`);
            console.log(`[🎯] NMAP RESULT:\n${intel.nmapData.substring(0, 200)}...`);
        } else {
            console.log(`[🔍] COUNTER-RECON: Localhost detected. Skipping GeoIP/Nmap.`);
            intel = { geoData: { country: 'Local Machine', city: 'Local', isp: 'Local' }, nmapData: 'Local Execution' };
        }

        let cmd = '';

        if (platform === 'linux') {
            const hexIp = ipToHex(ip);
            cmd = `sudo bpftool map update name blocklist key hex ${hexIp} value hex 01 00 00 00`;
        } else if (platform === 'win32') {
            cmd = `powershell.exe -Command "New-NetFirewallRule -DisplayName 'Bayezid_Drop_${ip}' -Direction Inbound -Action Block -RemoteAddress ${ip}"`;
        } else {
            console.log(`[⚠️] OS '${platform}' not fully supported for Kernel Striker yet.`);
            return intel;
        }

        try {
            await execPromise(cmd);
            console.log(`[☠️] OS Striker: IP ${ip} eradicated at Network Layer L3 (${platform.toUpperCase()}).`);
            ttlRegistry.set(ip, Date.now());
        } catch (err) {
            console.error(`[⚠️] Striker Error blocking ${ip} on ${platform}:`, err.message);
        }

        return intel;
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