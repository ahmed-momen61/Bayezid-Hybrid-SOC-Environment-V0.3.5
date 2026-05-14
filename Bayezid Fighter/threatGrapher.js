const fs = require('fs');
const path = require('path');

const ThreatGrapher = {
    generateReport: (data) => {
        const {
            ticketId,
            attackerIp,
            payload,
            mlScore,
            wardenStatus,
            mitreTactic,
            finalAction,
            severity = "HIGH",
            mlFeatures = { entropy: "N/A", symbols: "N/A", keywords: "N/A" },
            oracleAnalysis = "N/A",
            obfuscationType = "None"
        } = data;

        const reportsDir = path.join(__dirname, 'forensics_reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir);
        }

        const safePayload = payload.replace(/['"<>{}()]/g, '').substring(0, 40) + '...';
        const timestamp = new Date().toISOString();

        const markdownContent =
            `# Bayezid SOC: Forensic Root Cause Analysis (RCA)

## Incident Overview
* **Incident ID:** \`${ticketId}\`
* **Timestamp:** \`${timestamp}\`
* **Severity:** 🔴 **${severity}**
* **Status:** 🟢 **MITIGATED (Zero-Touch)**

---

## Indicators of Compromise (IoCs)
| Type | Value | Context |
| :--- | :--- | :--- |
| **Attacker IP (L3)** | \`${attackerIp}\` | Origin of the malicious request. |
| **Raw Payload** | \`${payload}\` | The exact string intercepted. |
| **MITRE ATT&CK** | \`${mitreTactic}\` | Threat categorization. |

---

## AI Cognitive Telemetry
*How the Neural Engine perceived the threat before execution:*
* **Isolation Forest Score:** \`${mlScore}\` *(Negative = Anomaly)*
* **Entropy Level:** \`${mlFeatures.entropy}\`
* **Symbol Density:** \`${mlFeatures.symbols}\`
* **Lethal Keywords:** \`${mlFeatures.keywords}\`

---

## 👁️ Oracle Reverse Engineering (Deobfuscation)
* **Obfuscation Method Detected:** \`${obfuscationType}\`
* **AI Behavioral Analysis:** \`${oracleAnalysis}\`

---

## Cognitive Threat Flow (Execution Graph)

\`\`\`mermaid
graph TD
    %% Node Styling
    classDef attacker fill:#ff4d4d,stroke:#333,stroke-width:2px,color:#fff;
    classDef filter fill:#8c1aff,stroke:#333,stroke-width:2px,color:#fff;
    classDef engine fill:#4d79ff,stroke:#333,stroke-width:2px,color:#fff;
    classDef sandbox fill:#ffcc00,stroke:#333,stroke-width:2px,color:#000;
    classDef action fill:#00cc66,stroke:#333,stroke-width:2px,color:#fff;

    A[Attacker IP: ${attackerIp}]:::attacker -->|Payload Injection| B(Kinetic L1 Filter):::filter
    B -->|Bypass / Regex Match| C{ML Sniper Analysis}:::engine
    C -->|Score: ${mlScore}| D(Warden Docker Sandbox):::sandbox
    D -->|Verdict: ${wardenStatus}| E[Decision Orchestrator]:::engine
    E -->|Trigger| F(( ${finalAction} )):::action
    E -->|Log| G[Vault & ITSM Ticket: ${ticketId}]
\`\`\`

---

## Autonomous Remediation Taken
1. **L3 Network Guillotine:** The attacker IP \`${attackerIp}\` was instantly injected into the OS Firewall/eBPF Map.
2. **TCP Termination:** All active and future packets from this source are dropped before reaching the Application Layer.
3. **TTL Activated:** The block will automatically expire in 24 hours to prevent memory exhaustion.

*End of Auto-Generated Report by Bayezid Cognitive SOC Orchestrator V0.3.4.*
`;

        const filePath = path.join(reportsDir, `${ticketId.replace(/[^a-zA-Z0-9-]/g, '')}.md`);
        fs.writeFileSync(filePath, markdownContent);

        console.log(`\n[🕸️] Enterprise Threat Report Generated: ${filePath}`);
    }
};

module.exports = ThreatGrapher;