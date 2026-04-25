import * as vscode from 'vscode';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { InventoryDetector } from './inventoryDetector.js';

export class Runner {
    private readonly inventoryDetector: InventoryDetector;
    private outputChannel: vscode.OutputChannel;

    constructor(inventoryDetector: InventoryDetector) {
        this.inventoryDetector = inventoryDetector;
        this.outputChannel = vscode.window.createOutputChannel('Ansible Runner');
    }

    public async run(playbookPath: string, extraFlags: string[]): Promise<void> {
        const inventory = await this.inventoryDetector.path ?? await this.inventoryDetector.detect();

        if (!inventory) {
            vscode.window.showErrorMessage(
                'Ansible Runner: No inventory file found or selected. Aborting.'
            );
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage(
                'Ansible Runner: No workspace folder open. Aborting.'
            );
            return;
        }

        const cwd = workspaceFolders[0].uri.fsPath;
        const config = vscode.workspace.getConfiguration('ansibleRunner');
        const configuredExtraFlags = config.get<string[]>('extraFlags') ?? [];

        const args = [
            '-i', inventory,
            ...configuredExtraFlags,
            ...extraFlags,
            playbookPath
        ];

        const displayName = path.basename(playbookPath);

        /* Mask the password */
        const displayFlags = extraFlags.map(f => f.startsWith('ansible_become_pass=') ? 'ansible_become_pass=********' : f);
        const flagSummary = displayFlags.length > 0 ? ` (${displayFlags.join(' ')})` : '';
        const displayArgs = args.map(arg => arg.startsWith('ansible_become_pass=') ? 'ansible_become_pass=********' : arg);

        this.outputChannel.show(true);
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(`▶ Running: ${displayName}${flagSummary}`);
        this.outputChannel.appendLine(`  Command: ansible-playbook ${args.join(' ')}`);
        this.outputChannel.appendLine(`  CWD:     ${cwd}`);
        this.outputChannel.appendLine('─'.repeat(60));

        await this.execute('ansible-playbook', args, cwd);
    }

    private execute(
        command: string,
        args: string[],
        cwd: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args, {
                cwd,
                env: { ...globalThis.process.env },
                shell: false
            });

            process.stdout.on('data', (data: Buffer) => {
                this.outputChannel.append(data.toString());
            });

            process.stderr.on('data', (data: Buffer) => {
                this.outputChannel.append(data.toString());
            });

            process.on('close', (code: number | null) => {
                this.outputChannel.appendLine('─'.repeat(60));
                if (code === 0) {
                    this.outputChannel.appendLine(`✓ ${path.basename(args[args.length - 1])} completed successfully`);
                    vscode.window.showInformationMessage(
                        `Ansible Runner: ${path.basename(args[args.length - 1])} completed successfully.`
                    );
                    resolve();
                } else {
                    this.outputChannel.appendLine(`✗ Failed with exit code ${code}`);
                    vscode.window.showErrorMessage(
                        `Ansible Runner: ${path.basename(args[args.length - 1])} failed with exit code ${code}.`
                    );
                    reject(new Error(`Process exited with code ${code}`));
                }
            });

            process.on('error', (err: Error) => {
                this.outputChannel.appendLine(`✗ Failed to start process: ${err.message}`);
                vscode.window.showErrorMessage(
                    `Ansible Runner: Failed to start ansible-playbook. Is it installed and on your PATH?`
                );
                reject(err);
            });
        });
    }
}