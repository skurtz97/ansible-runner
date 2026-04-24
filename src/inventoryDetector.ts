import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export class InventoryDetector {
    private inventory: string | undefined;

    public async detect(): Promise<string | undefined> {
        // Check workspace settings first
        const config = vscode.workspace.getConfiguration('ansibleRunner');
        const configuredInventory = config.get<string>('inventory');
        if (configuredInventory && configuredInventory.trim() !== ''){
            this.inventory = configuredInventory;
            return this.inventory;
        }

        // Fall back to auto-detecting inventory.yml in workspace root
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0){
            return undefined;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const candidatePath = path.join(rootPath, 'inventory.yml');

        try {
            await fs.access(candidatePath);
            this.inventory = candidatePath;
            return this.inventory;
        } catch {
            // inventory.yml not found - prompt the user
            const result = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: { 'YAML files': ['yml', 'yaml']},
                title: 'Select Ansible Inventory File'
            });

            if (result && result.length > 0){
                this.inventory = result[0].fsPath;
                // Offer to save it to workspace settings so they aren't
                // prompted again.
                const save = await vscode.window.showInformationMessage(
                    'Save this inventory path to workspace settings?',
                    'Yes', 'No'
                );
                if (save === 'Yes' ){
                    await config.update(
                        'inventory',
                        this.inventory,
                        vscode.ConfigurationTarget.Workspace
                    );
                }

                return this.inventory;

            }

            return undefined;
        }

    }

    public get path(): string | undefined {
        return this.inventory;
    }

    public async redetect(): Promise<string | undefined> {
        this.inventory = undefined;
        return await this.detect();
    }
}