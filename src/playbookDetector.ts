import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export class PlaybookDetector {
    private readonly excludedDirs = new Set([
        'node_modules',
        '.git',
        '.vscode',
        'out',
        'roles',
        'group_vars',
        'host_vars'
    ]);

    public async detect(): Promise<string[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const yamlFiles = await this.scanDirectory(rootPath);
        const playbooks: string[] = [];

        for (const file of yamlFiles) {
            if (await this.isPlaybook(file)) {
                playbooks.push(file);
            }
        }

        return playbooks.sort();

    }

    private async scanDirectory(dirPath: string): Promise<string[]> {
        const results: string[] = [];

        let entries;
        try {
            entries = await fs.readdir(dirPath, { withFileTypes: true });
        } catch {
            return results;
        }

        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (this.excludedDirs.has(entry.name)) {
                    continue;
                }
                const subResults = await this.scanDirectory(
                    path.join(dirPath, entry.name)
                );
                results.push(...subResults);
            } else if (
                entry.isFile() &&
                (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))
            ) {
                results.push(path.join(dirPath, entry.name));
            }

        }

        return results;

    }

    private async isPlaybook(filePath: string): Promise<boolean> {
        let content: string;
        try {
            content = await fs.readFile(filePath, 'utf-8');
        } catch {
            return false;
        }

        // Direct playbook: has tasks defined at play level
        if (this.hasTasks(content)) {
            return true;
        }

        // Site-style playbook: imports other playbooks
        if (this.hasPlaybookImports(content)) {
            return true;
        }

        return false;
    }

    private hasTasks(content: string): boolean {
        // Match 'tasks:' that appears at the play level (2 or 4 spaces indent)
        // but not deeply nested (e.g. in role definitions)
        return /^\s{0,4}tasks\s*:/m.test(content);
    }

    private hasPlaybookImports(content: string): boolean {
        return /ansible\.builtin\.import_playbook/m.test(content);
    }

}