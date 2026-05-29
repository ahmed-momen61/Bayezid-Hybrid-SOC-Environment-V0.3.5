const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const escodegen = require('escodegen');
const stripComments = require('strip-comments');
const aiServicePath = path.join(__dirname, 'aiService.js');
const sourceCode = fs.readFileSync(aiServicePath, 'utf8');
let cleanCode = stripComments(sourceCode);
console.log("[+] Comments completely stripped from aiService.js");
if (!cleanCode.includes("const { isAllowedTarget } = require('./securityGovernor');")) {
    cleanCode = "const { isAllowedTarget } = require('./securityGovernor');\n" + cleanCode;
}
if (!cleanCode.includes("const { dataHarvester } = require('../core_ai/bayezidBrain');")) {
    cleanCode = "const { dataHarvester } = require('../core_ai/bayezidBrain');\n" + cleanCode;
}
const ast = acorn.parse(cleanCode, { ecmaVersion: 'latest', sourceType: 'module' });
const agentsToPatch = [
    'runScoutAgent', 'runBreacherAgent', 'runPhantomAgent', 'runChameleonAgent',
    'runZeroDayForgeAgent', 'runAlchemistAgent', 'runMirageAgent', 'runScribeAgent',
    'runActionAgent', 'runAuditorAgent', 'runStealthScribeAgent', 'runVetoAgent',
    'runShadowRouterAgent', 'runForensicRCAAgent', 'runWardenSandbox', 'runOverlordAgent'
];
const injectGovernorNode = (targetVarName) => {
    return {
        type: "IfStatement",
        test: {
            type: "UnaryExpression",
            operator: "!",
            prefix: true,
            argument: {
                type: "CallExpression",
                callee: { type: "Identifier", name: "isAllowedTarget" },
                arguments: [{ type: "Identifier", name: targetVarName }],
                optional: false
            }
        },
        consequent: {
            type: "BlockStatement",
            body: [{
                type: "ReturnStatement",
                argument: {
                    type: "ObjectExpression",
                    properties: [
                        { type: "Property", key: { type: "Identifier", name: "status" }, value: { type: "Literal", value: "BLOCKED" }, kind: "init" },
                        { type: "Property", key: { type: "Identifier", name: "message" }, value: { type: "Literal", value: "Governor Lockout" }, kind: "init" }
                    ]
                }
            }]
        },
        alternate: null
    };
};
ast.body.forEach(node => {
    if (node.type === 'VariableDeclaration' && node.declarations.length > 0) {
        const dec = node.declarations[0];
        if (dec.id && dec.id.type === 'Identifier' && agentsToPatch.includes(dec.id.name)) {
            if (dec.init && (dec.init.type === 'ArrowFunctionExpression' || dec.init.type === 'FunctionExpression')) {
                let targetVarName = null;
                if (dec.init.params.length > 0 && dec.init.params[0].type === 'Identifier') {
                    targetVarName = dec.init.params[0].name;
                }
                if (targetVarName && dec.init.body.type === 'BlockStatement') {
                    const body = dec.init.body.body;
                    let alreadyInjected = false;
                    for (const stmt of body) {
                        if (stmt.type === 'IfStatement' && 
                            stmt.test.type === 'UnaryExpression' && 
                            stmt.test.argument.type === 'CallExpression' && 
                            stmt.test.argument.callee.name === 'isAllowedTarget') {
                            alreadyInjected = true;
                            break;
                        }
                    }
                    if (!alreadyInjected) {
                        body.splice(1, 0, injectGovernorNode(targetVarName));
                        console.log(`[+] Injected Governor Lock into AST for ${dec.id.name}`);
                    }
                }
            }
        }
    }
});
const generatedCode = escodegen.generate(ast);
fs.writeFileSync(aiServicePath, generatedCode);
console.log("[✅] Successfully wrote AST-patched aiService.js");
const serverPath = path.join(__dirname, 'server.js');
let serverCode = fs.readFileSync(serverPath, 'utf8');
serverCode = stripComments(serverCode);
fs.writeFileSync(serverPath, serverCode);
console.log("[+] Comments completely stripped from server.js");
