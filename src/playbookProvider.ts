import * as vscode from 'vscode';
import * as path from 'node:path';
import { PlaybookDetector } from './playbookDetector.js';

export class PlaybookItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly resourceUri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.contextValue = 'playbook';
        this.tooltip = resourceUri.fsPath;
        this.iconPath = new vscode.ThemeIcon('file');
    }
}

export class PlaybookActionItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly command: vscode.Command,
        public readonly iconId: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = command;
        this.iconPath = new vscode.ThemeIcon(iconId);
        this.contextValue = 'playbookAction';
    }
}

export class PlaybookProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private readonly detector: PlaybookDetector;
    private readonly _onDidChangeTreeData =
        new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();

    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor() {
        this.detector = new PlaybookDetector();
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    public async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            return this.getPlaybooks();
        }

        if (element instanceof PlaybookItem) {
            return this.getActions(element);
        }

        return [];
    }

    private async getPlaybooks(): Promise<PlaybookItem[]> {
        const playbooks = await this.detector.detect();

        if (playbooks.length === 0) {
            return [];
        }

        return playbooks.map((filePath) => {
            const label = this.getRelativeLabel(filePath);
            return new PlaybookItem(
                label,
                vscode.Uri.file(filePath),
                vscode.TreeItemCollapsibleState.Collapsed
            );
        });
    }

    private getActions(playbook: PlaybookItem): PlaybookActionItem[] {
        return [
            new PlaybookActionItem('Run', {
                command: 'ansibleRunner.run',
                title: 'Run',
                arguments: [playbook]
            }, 'play'),
            new PlaybookActionItem('Run with Sudo', {
                command: 'ansibleRunner.runWithSudo',
                title: 'Run with sudo',
                arguments: [playbook]
            }, 'shield'),
            new PlaybookActionItem('Run Verbose', {
                command: 'ansibleRunner.runVerbose',
                title: 'Run Verbose',
                arguments: [playbook]
            }, 'output'),
        ];
    }

    private getRelativeLabel(filePath: string): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return path.basename(filePath);
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const relative = path.relative(rootPath, filePath);

        // If the file is directly in the root, just show the filename
        // otherwise show the relative path so you know which subdirectory it's in
        return relative.includes(path.sep) ? relative : path.basename(filePath);
    }
}