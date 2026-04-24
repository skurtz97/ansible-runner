import * as vscode from "vscode";
import { PlaybookProvider } from "./playbookProvider.js";
import { Runner } from "./runner.js";
import { InventoryDetector } from "./inventoryDetector.js";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const inventoryDetector = new InventoryDetector();
    const playbookProvider = new PlaybookProvider();
    const runner = new Runner(inventoryDetector);

    const treeView = vscode.window.createTreeView('ansibleRunnerPlaybooks', {
        treeDataProvider: playbookProvider,
        showCollapseAll: false
    });

    context.subscriptions.push(treeView);

    context.subscriptions.push(
        vscode.commands.registerCommand("ansibleRunner.refresh", () => {
            playbookProvider.refresh();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ansibleRunner.run', async (item) => {
            await runner.run(item.resourceUri.fsPath, []);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "ansibleRunner.runVerbose",
            async (item) => {
                await runner.run(item.resourceUri.fsPath, ["-vvv"]);
            },
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("ansibleRunner.dryRun", async (item) => {
            await runner.run(item.resourceUri.fsPath, ["--check"]);
        }),
    );

    // Re-scan if .yml files are added or removed
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.yml');
    watcher.onDidCreate(() => playbookProvider.refresh());
    watcher.onDidDelete(() => playbookProvider.refresh());
    context.subscriptions.push(watcher);
}


export function deactivate(): void {}