import * as fs from 'fs';
import * as path from 'path';
export function loadDetectionPlaybook(playbookName: string, variables: Record<string, string> = {}): string {
    const safeName = path.basename(playbookName); 
    const playbookPath = path.resolve(__dirname, 'detectionPlaybooks', `${safeName}.txt`);
    if (!fs.existsSync(playbookPath)) {
        throw new Error(`[PromptManager] Detection Playbook not found: ${playbookName}`);
    }
    let content = fs.readFileSync(playbookPath, 'utf8');
    const includeRegex = /@include\(([^)]+)\)/g;
    content = content.replace(includeRegex, (match, includeName) => {
        const safeInclude = path.basename(includeName);
        const includePath = path.resolve(__dirname, 'detectionPlaybooks', `${safeInclude}.txt`);
        if (fs.existsSync(includePath)) {
            return fs.readFileSync(includePath, 'utf8');
        } else {
            console.warn(`[PromptManager] Warning: Include not found: ${includeName}`);
            return '';
        }
    });
    for (const [key, value] of Object.entries(variables)) {
        const varRegex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(varRegex, value);
    }
    return content;
}
