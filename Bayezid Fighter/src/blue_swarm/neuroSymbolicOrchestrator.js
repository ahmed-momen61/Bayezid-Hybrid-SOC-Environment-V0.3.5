const { DefenseMARL } = require('./defenseMARL');
const { EpistemicEngine } = require('./epistemicEngine');
const { verifyDefensiveAction } = require('./causalVerifier');
const { recall: episodicRecall } = require('../memory_systems/episodicMemory');
const marl = new DefenseMARL(
  ['Auditor', 'Warden', 'Action'],
  [
    { type: 'OBSERVE' }, { type: 'DECEPTIVE_PROBE' }, { type: 'ESCALATE_RESPONSE' },
    { type: 'ACTIVE_NEUTRALIZATION' }, { type: 'ISOLATE_NODE' }, { type: 'PROACTIVE_HUNT' }
  ]
);
const epistemicEngine = new EpistemicEngine();
const synthesiseDecision = (epistemic, causalVerdict, memory) => {
  let actionType = epistemic.approvedAction.type;
  if (causalVerdict.safe === false && causalVerdict.downtime_risk > 0.3) {
    actionType = 'DECEPTIVE_PROBE';
    console.log(`[🧠] CAUSAL VETO: Downgraded due to downtime risk ${causalVerdict.downtime_risk}`);
  } else if (memory.hasMemory && memory.pastMitigation && memory.pastMitigation.outcome?.success === false) {
    actionType = 'ESCALATE_RESPONSE';
    console.log(`[🧠] EPISODIC VETO: Past similar action failed. Escalating.`);
  }
  return {
    type: actionType,
    confidence: epistemic.calibratedConfidence,
    causalRisk: causalVerdict.downtime_risk,
    episodicContext: memory.pastMitigation?.actionTaken || null
  };
};
const makeVerifiedDefensiveDecision = async (state, alert) => {
  const proposedActions = marl.chooseJointAction(state);
  const primaryAction = proposedActions[0];
  const epistemic = epistemicEngine.evaluateDoubtProtocol(primaryAction, primaryAction.confidence || 0.7, state);
  const causalVerdict = await verifyDefensiveAction(epistemic.approvedAction.type, alert.sourceIp || 'unknown', []);
  const memory = await episodicRecall(alert);
  const finalAction = synthesiseDecision(epistemic, causalVerdict, memory);
  console.log(`[🎯] VERIFIED DECISION: ${finalAction.type} | Confidence: ${finalAction.confidence.toFixed(3)} | CausalRisk: ${finalAction.causalRisk}`);
  return {
    finalAction,
    epistemic,
    causalVerdict,
    memory,
    allProposedActions: proposedActions
  };
};
module.exports = { makeVerifiedDefensiveDecision, synthesiseDecision };
