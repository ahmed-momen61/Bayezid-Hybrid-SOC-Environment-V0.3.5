# Bayezid Hybrid SOC Environment V0.3.4 (The Closed-Loop Adaptive Defense Update)

![Version](https://img.shields.io/badge/Version-3.4-red.svg)
![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)
![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![Prisma](https://img.shields.io/badge/ORM-Prisma-white.svg)
![AI-Powered](https://img.shields.io/badge/AI-Cognitive_Multi_Agent-orange.svg)
![ML](https://img.shields.io/badge/ML-Isolation_Forest-yellow.svg)
![Vector-DB](https://img.shields.io/badge/Memory-pgvector-purple.svg)
![Encryption](https://img.shields.io/badge/Security-AES_256_CBC-yellow.svg)

**Bayezid V0.3.4 is a revolutionary Cognitive SOC Orchestrator that transcends traditional SOAR boundaries. It is a self-evolving security ecosystem that thinks, remembers, mitigates, and acts with sub-millisecond precision.**

By merging **Vector-Based Institutional Memory** with a **Multi-Agent AI Architecture** and an **Unsupervised Machine Learning Engine**, Bayezid transforms the SOC from a reactive ticketing system into an autonomous digital guardian. It features a unique hybrid engine that balances elite Cloud Intelligence with robust Local LLM fallbacks, ensuring that defense never sleeps—even during network outages.

---

## Core Value Propositions (The Trinity Expansion & The Intelligence Loop)

Bayezid is engineered to solve the "Big Three" SOC challenges: Alert Fatigue, Vendor Lock-in, and Cognitive Overhead, while introducing state-of-the-art offensive capabilities, autonomous remediation, and the newly integrated **Self-Learning Architecture**.

* **Live Kinetic Filter (The Fast Shield):** A true live in-memory filter acting as the first line of defense. It features a **Deep Payload Normalizer** (Double URL Decoding & Null-Byte Stripping) and a **Flexible Regex Engine** to catch obfuscated SQLi/XSS.

* **ML Hash Caching (Zero-CPU Shield):** Before invoking complex analysis, Bayezid hashes incoming payloads. If a known threat reappears, the Intelligence Cache drops it in **<0.01ms** (Zero-CPU footprint), rendering DDoS attacks using malicious payloads ineffective.

* **The ML Sniper (4-Dimensional Isolation Forest):** A Python-based unsupervised learning microservice. It detects Zero-Day anomalies by analyzing statistical deviations across 4 dimensions: *Length, Symbol Density, Entropy, and Keyword Amplification (20x weighted penalty for lethal keywords like 'union', 'sleep', 'admin')*.

* **The Warden Sandbox (Dynamic Analysis):** When the ML Sniper detects a statistical anomaly (Zero-Day), Bayezid doesn't guess. It spins up an isolated Docker container (`runWardenSandbox`) to dynamically execute the payload and observe its behavioral intent (e.g., Container Escape, Host Reconnaissance).

* **The Intelligence Feedback Loop (Continuous Self-Learning):** Bayezid corrects its own ML engine. If the Warden Sandbox deems a statistically anomalous payload as "Safe" (False Positive), Bayezid automatically sends a feedback signal to the Python microservice. The ML Sniper retrains itself instantly, ensuring zero redundant false positives.

* **Persistent AI Memory:** The ML Sniper utilizes `joblib` and `numpy` to save its evolving training dataset to disk (`bayezid_model.pkl` & `normal_traffic.npy`). Bayezid wakes up smarter every day, carrying over its learned intelligence across reboots.

* **The Alchemist Agent (Adaptive Exploit Mutation):** Radically transforms Red Team operations by executing a live fuzzing loop directly on the target OS via `smartExec`. If blocked, it ingests stderr/stdout, mutates the payload dynamically, and re-fires until initial access is secured.

* **The Cognitive Mirage Agent (High-Interaction Deception):** Upgrades the Honeypot to a psychological trap. A live TCP daemon (port 2222) acts as a **Strategic Censor**—stripping Bayezid's source code from the output—and injects highly contextual, dynamically hallucinated 'Honeytokens' tailored to the attacker's intent.

* **Closed-Loop Auto-Remediation (Red-to-Blue Bridge):** Bridges offensive discovery with defensive mitigation. Upon detecting a vulnerability, the Blue Team autonomously classifies the threat, synthesizes executable mitigation code, and applies the patch directly.

* **Hybrid Resilience (The Ultimate Failover):** The system prioritizes **Google Gemini 2.5 Flash** but features an instantaneous, transparent failover to **Local AI (Qwen 2.5 / Ollama)** if the cloud experiences latency or quota limits. The Cognitive flow never breaks.

---

## Architectural Pillars

The system is built on a modular, event-driven architecture designed for high-throughput security telemetry, elite offensive simulations, and adaptive self-healing.

### 1. The Blue Team Engine (Cognitive Defense)

* **Stage 1 Triage (Kinetic Filter & ML Cache):** Drops non-malicious noise, strips obfuscation, and enforces Zero-CPU blocking for known malicious hashes.

* **Stage 2 Heuristics & ML (The Sniper):** Identifies Zero-Day patterns via statistical Anomaly Detection (Isolation Forest).

* **Stage 3 Dynamic Analysis (The Warden):** Executes unknown threats in an isolated Docker Sandbox.

* **Stage 4 Intelligence Loop:** Corrects the ML model based on sandbox behavioral verdicts.

### 2. The Red Team Swarm (Autonomous Offensive APT)

When toggled to **RED MODE**, Bayezid activates a proactive, fully autonomous offensive squad:

* **The Scout (Reconnaissance):** Formulates sophisticated WAF-bypass commands.

* **The Alchemist (Initial Access & Fuzzing):** Operates a live mutation loop to bypass EDRs/Execution Policies.

* **The Phantom (Privilege Escalation):** An OS internals ghost. Capable of executing container breakouts and LotL tactics.

* **The Chameleon (Stealth):** Executes flawless, zero-code log wiping and track-clearing maneuvers.

### 3. The Red-to-Blue Bridge (Adaptive Cyber Defense)

* **Automated Regression Testing:** Post-remediation, the system automatically summons the Red Team to re-fire the exact mutated exploit payload against the patched endpoint, guaranteeing the mitigation is mathematically sound.

---

## Service Breakdown (The Micro-Service Logic)

| Service | Responsibility | Technology |
| --- | --- | --- |
| **`server.js`** | Central Orchestrator, Fallback Routing, Sandboxing, Feedback Loop | Node.js / Express / Child Process |
| **`ml_engine/main.py`** | The ML Sniper (Isolation Forest), Persistent Memory, Keyword Amplification | Python / FastAPI / Scikit-Learn |
| **`kineticFilter.js`** | ML Hash Caching, Deep Normalization, Flexible Regex, Feature Extraction prep | JavaScript / Crypto |
| **`aiService.js`** | Multi-Agent Logic, Smart Exec, Warden Sandbox, Failover logic (Cloud -> Local) | Gemini / Qwen / Docker |
| **`memoryService.js`** | Vector Storage & Semantic Similarity Search | pgvector / Embeddings |

---

### Prerequisites

* **Node.js:** v20.x or higher.
* **Python:** v3.10 or higher.
* **Database:** PostgreSQL with the `pgvector` extension.
* **Docker:** Required for `Warden Sandbox` dynamic analysis.
* **Local AI (Optional):** Ollama installed for the local fallback engine.

---

## API Documentation (Testing the Cognitive Capabilities)

You can test the core AI capabilities via these bridge endpoints using Postman:

**1. Report Live Threat (The 3-Tier Sieve Test)**

* `POST /api/v1/bridge/report-vuln`
* Body (SQLi Bypass Test): `{ "vulnName": "Stealthy SQLi", "evidence": "user_id=101%2527%2520%2520%2520%2520UnIoN%2520%2520%2520SeLeCt%2520%2520%25201%252C2%252C3%2500--%2520" }`

**2. The ML Keyword Trap (Anomaly Testing)**

* `POST /api/v1/bridge/report-vuln`
* Body: `{ "vulnName": "ML Pure Keyword Trap", "evidence": "user_role=admin_level&timeout_action=sleep_now&task=waitfor_signal" }`
* *(Watch the ML Sniper amplify the keywords, the Warden sandbox analyze it, and the Feedback Loop update the Python model).*

**3. Cognitive Risk Analysis & Virtual Patch Synthesis**

* `POST /api/v1/bridge/analyze`
* Body: `{ "vulnId": "<UUID>", "autonomyMode": "Sniper" }`

**4. Post-Breach Root Cause Analysis (Forensic RCA)**

* `POST /api/v1/bridge/rca`
* Body: `{ "vulnId": "<UUID>" }`

---

## Environment Variables (.env)

```env
PORT=3000

DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>"
DIRECT_URL="postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>"

AI_MODE=CLOUD
GEMINI_API_KEY="AIzaSy_YOUR_GEMINI_API_KEY_HERE"
GOOGLE_API_KEY="AIzaSy_YOUR_GOOGLE_API_KEY_HERE"
LOCAL_MODEL_NAME="qwen2.5-coder:7b"
OLLAMA_BASE_URL="http://localhost:11434"

TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN_HERE"
TELEGRAM_CHAT_ID="YOUR_TELEGRAM_CHAT_ID_HERE"

ENCRYPTION_KEY="your_64_character_hex_string_here"
ENCRYPTION_IV="your_32_character_hex_string_here"

OTX_API_KEY="your_alienvault_otx_api_key_here"

OPENCTI_URL="https://your-opencti-instance-url"
OPENCTI_TOKEN="your_opencti_token_here"

SLA_TIMEOUT_MINUTES=5

```

---

**Bayezid Fighter** — **Yildirim Logic — The Strike Before the Signal**

Developed by: **Ahmed Mo'men Ahmed** | 2026.
