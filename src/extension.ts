import * as vscode from 'vscode';

import { ViewerProvider } from './ViewerProvider';


export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(ViewerProvider.register(context));
}

export function deactivate() {

}
