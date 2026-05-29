const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
class eBPFBridge {
    constructor(basePath = '/sys/fs/bpf/bayezid') {
        this.basePath = basePath;
        this.blocklistMap = `${this.basePath}/bayezid_blocklist`;
        this.weightsMap = `${this.basePath}/bayezid_neural_weights`;
        this.modeMap = `${this.basePath}/bayezid_ebpf_mode`;
    }
    _ipToHex(ipStr) {
        const parts = ipStr.split('.');
        if (parts.length !== 4) throw new Error('Invalid IPv4 address');
        return `hex ${parts.map(p => parseInt(p, 10).toString(16).padStart(2, '0')).join(' ')}`;
    }
    async setEbpfMode(mode) {
        const value = mode === 'monitor' ? 'hex 01 00 00 00' : 'hex 00 00 00 00';
        try {
            await execPromise(`bpftool map update pinned ${this.modeMap} key hex 00 00 00 00 value ${value}`);
            console.log(`[eBPF Bridge] Execution mode set to: ${mode}`);
        } catch (e) {
            console.error(`[eBPF Bridge] Failed to set mode: ${e.message}`);
        }
    }
    async addToBlocklist(ipStr) {
        try {
            const keyHex = this._ipToHex(ipStr);
            const valueHex = 'hex 01 00 00 00'; 
            await execPromise(`bpftool map update pinned ${this.blocklistMap} key ${keyHex} value ${valueHex}`);
            console.log(`[eBPF Bridge] IP ${ipStr} added to kernel blocklist.`);
        } catch (e) {
            console.error(`[eBPF Bridge] Failed to block IP ${ipStr}: ${e.message}`);
        }
    }
    async removeFromBlocklist(ipStr) {
        try {
            const keyHex = this._ipToHex(ipStr);
            await execPromise(`bpftool map delete pinned ${this.blocklistMap} key ${keyHex}`);
            console.log(`[eBPF Bridge] IP ${ipStr} removed from kernel blocklist.`);
        } catch (e) {
            console.error(`[eBPF Bridge] Failed to unblock IP ${ipStr}: ${e.message}`);
        }
    }
    async updateNeuralWeights(modelId, weightsArray) {
        if (weightsArray.length !== 9) throw new Error('Neural Net requires 8 weights + 1 bias');
        let valueStr = 'hex ';
        for (const w of weightsArray) {
            const buffer = Buffer.alloc(8);
            buffer.writeBigInt64LE(BigInt(Math.round(w)));
            valueStr += buffer.toString('hex').match(/../g).join(' ') + ' ';
        }
        try {
            const keyHex = `hex ${modelId.toString(16).padStart(2, '0')} 00 00 00`;
            await execPromise(`bpftool map update pinned ${this.weightsMap} key ${keyHex} value ${valueStr.trim()}`);
            console.log(`[eBPF Bridge] Neural weights updated for Model ID ${modelId}`);
        } catch (e) {
            console.error(`[eBPF Bridge] Failed to update weights: ${e.message}`);
        }
    }
}
module.exports = new eBPFBridge();
