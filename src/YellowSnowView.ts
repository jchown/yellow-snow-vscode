import * as vscode from 'vscode';

export class YellowSnowView implements vscode.CustomDocument {
	uri: vscode.Uri;

	constructor(uri: vscode.Uri) {
		this.uri = uri;
	}

	dispose(): void {
	}
}
