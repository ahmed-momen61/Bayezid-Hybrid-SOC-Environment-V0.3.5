import { useState } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { FileText, Search, Activity, Cpu } from 'lucide-react';

const MOCK_REPORTS = {
  strategic: `
# Strategic Intelligence Report
**Classification:** TOP SECRET // COMPARTMENTED
**Date:** 2026-05-22

## Global Threat Landscape
Recent shifts in the kinetic theater have revealed a new class of polymorphic adversaries. The 'Hydra' C2 framework has been observed dynamically swapping execution payloads in memory to evade EDR sensors.

### Primary Objectives
1. Fortify the Sigma Loop to detect memory anomalies.
2. Ensure the Veritas Ledger records all chain-of-custody for forensic artifacts.
3. Deploy the Shadow Mirror to entrap active sessions.
  `,
  osint: `
# OSINT Crawler Findings
**Target:** Dark Web Forums (x0r, Exploit.in)
**Confidence:** High (85%)

## Emerging CVE Chatter
- **CVE-2026-8899:** RCE in popular CI/CD pipelines. Weaponized PoC expected within 48 hours.
- **Botnet Expansion:** The 'Chimera' botnet has increased its footprint by 20% across IoT devices in Eastern Europe.

### Recommended Action
Pre-emptively block known Chimera C2 exit nodes. Update YARA signatures.
  `,
  cti: `
# Cyber Threat Intelligence Feed
**Source:** MISP / AlienVault OTX
**Updates:** 14 new indicators

## Active IOCs
| Indicator | Type | Threat | Severity |
|---|---|---|---|
| 104.28.14.3 | IP | Cobalt Strike | Critical |
| c2-hidden-realm.io | Domain | Phishing | High |
| a9f3c... | SHA256 | Ransomware | Critical |

All indicators have been automatically ingested into the Kinetic Filter.
  `,
  ml: `
# Machine Learning Synthesis
**Model:** Qwen-14B-LoRA
**Status:** Online

## Behavioral Anomalies
- The model detected a 400% spike in anomalous `+` packets attempting lateral movement via SMB.
- Evasion pattern recognized: Attackers are using 'time-stretching' to bypass rate limits.

**Federated Action:** Weights have been synchronized across the swarm. The local oracle has adapted the baseline.
  `
};

export default function IntelligenceHub() {
  const [activeTab, setActiveTab] = useState<'strategic' | 'osint' | 'cti' | 'ml'>('strategic');

  const tabs = [
    { id: 'strategic', label: 'Strategic Intel', icon: FileText },
    { id: 'osint', label: 'OSINT Crawler', icon: Search },
    { id: 'cti', label: 'CTI Feed', icon: Activity },
    { id: 'ml', label: 'ML Synthesis', icon: Cpu },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <FileText className="text-cyan-400" />
          INTELLIGENCE HUB
        </h1>
        <p className="text-sm text-slate-400">Decoupled Markdown Reports & Global Threat Synthesis</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800 mb-6 shrink-0 max-w-2xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id 
                ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl p-6 custom-scrollbar relative">
        {/* We use a wrapper to override light mode defaults in the markdown preview */}
        <div data-color-mode="dark" className="bg-transparent">
          <MarkdownPreview 
            source={MOCK_REPORTS[activeTab]} 
            style={{ backgroundColor: 'transparent' }}
          />
        </div>
      </div>
    </div>
  );
}
