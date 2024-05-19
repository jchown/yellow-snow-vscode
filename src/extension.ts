import * as vscode from 'vscode';

import { ViewerProvider } from './ViewerProvider';

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(ViewerProvider.register(context));

	let disposable = vscode.commands.registerCommand('yellowSnow.openView', async (uri?: vscode.Uri) => {
		if (!uri && vscode.window.activeTextEditor) {
		  uri = vscode.window.activeTextEditor.document.uri;
		}
	
		if (uri) {
		  await vscode.commands.executeCommand('vscode.openWith', uri, ViewerProvider.viewType);
		}
	  });
	
	  context.subscriptions.push(disposable);
}

export function deactivate() {

}
	