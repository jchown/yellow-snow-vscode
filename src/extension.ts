import * as vscode from 'vscode';

import { Color } from './Color';
import { Theme } from './Theme';
import { Change } from './Change';
import { LineFile } from './LineFile';
import { ThemeID } from './ThemeID';

let minimapDecorations: vscode.TextEditorDecorationType[] = [];

export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.commands.registerCommand('yellowSnow.openView', () => {

	    // Get the active text editor
		const editor = vscode.window.activeTextEditor;
		if (editor) {
		  let configuration = vscode.workspace.getConfiguration("yellowSnow");
		  let theme = configuration.get<ThemeID>("theme");
		  openYellowSnowView(editor.document, theme || ThemeID.YellowSnow);
		}
	});	

	context.subscriptions.push(disposable);
}

function openYellowSnowView(document: vscode.TextDocument, theme: ThemeID) {
	// Create a new read-only text editor
	vscode.window.showTextDocument(document, {
	  preview: false,
	  viewColumn: vscode.ViewColumn.Beside,
	  preserveFocus: true
	}).then((editor) => {
	  // Set the background color of each line based on the git history
	  colorizeLines(editor, theme);
	});
  }

const themes = new Map<ThemeID, Theme>([
	[ThemeID.YellowSnow, new Theme("YS", new Color(0, 0, 0), new Color(0, 0, 0), new Color(255, 255, 255), new Color(255, 255, 0))],
	[ThemeID.PurpleStain, new Theme("PS", new Color(255, 255, 255), new Color(255, 255, 0), new Color(29, 12, 40), new Color(87, 38, 128))]
]);

function getBGColor(theme: Theme, level: number) {
	var from = theme.bgOld;
	var to = theme.bgNew;

	return getColor(level, from, to);
}
	
function getFGColor(theme: Theme, level: number) {
	var from = theme.fgOld;
	var to = theme.fgNew;

	return getColor(level, from, to);
}
	
function getColor(level: number, from: Color, to: Color) {

	if (level < 0 || level > 255) {
		throw new Error(`Invalid level: ${level}`);
	}

	var dR = (to.red - from.red);
	var dG = (to.green - from.green);
	var dB = (to.blue - from.blue);

	var l = level / 255.0;
	var r = Math.floor(dR * l + from.red);
	var g = Math.floor(dG * l + from.green);
	var b = Math.floor(dB * l + from.blue);

	return new Color(r, g, b);
}

function colorizeLines(editor: vscode.TextEditor, themeID: ThemeID) {
	const document = editor.document;
	const lines = document.lineCount;
	const filename = document.fileName;
	const gitHistory = getGitHistory(filename);
	const colorMap = calculateColorMap(new Set(gitHistory.lines.map((line) => line.timestamp)));

	//var theme = themes["Yellow Snow"];
	var theme = themes.get(themeID);
	if (theme === undefined || theme === null) {
        throw new Error(`Invalid theme: ${themeID}`);
    }

	for (let i = 0; i < lines; i++) {
		const line = document.lineAt(i);
		const level = colorMap.get(gitHistory.lines[i].timestamp) || 0;
//		const level = Math.floor((255.0 * i) / lines);
		const bgColor = getBGColor(theme, level).toHex();
		const fgColor = getFGColor(theme, level).toHex();

		editor.setDecorations(vscode.window.createTextEditorDecorationType({
			color: fgColor,
			backgroundColor: bgColor,
			isWholeLine: true,
			before: {
				contentText: gitHistory.lines[i].author.substring(0, 8) + " ",
				color: fgColor,
				backgroundColor: bgColor
			}
		}), [line.range]);

		/*
		const decoration = vscode.window.createTextEditorDecorationType({
			isWholeLine: true,
			renderOptions: {
				minimap: {
					color: new vscode.ThemableDecorationAttachmentRenderOptions(
						new vscode.ThemableDecorationRenderOptions({
							backgroundColor: new vscode.ThemeColor(`myExtension.minimapBackgroundColor${i}`),
							foregroundColor: new vscode.ThemeColor(`myExtension.minimapForegroundColor${i}`),
						})
					),
				},
			},
		});


		minimapDecorations.push(decoration);

		// Apply the decoration to the corresponding line
		const lineRange = document.lineAt(i).range;
		editor.setDecorations(decoration, [lineRange]);
		*/
	}
}

function calculateColorMap(timestamps: Set<number>): Map<number, number> {
	const colorMap = new Map<number, number>();
	colorMap.set(0, 0);
  
	if (timestamps.size === 0) {
	  console.log("No timestamps");
	  return colorMap;
	}
  
	let minTime = 1 << 62;
	let maxTime = -1 << 62;
  
	const sorted: number[] = [];
  
	for (const timestamp of timestamps) {
	  if (timestamp === 0) {
		continue;
	  }
  
	  if (minTime > timestamp) {
		minTime = timestamp;
	  }
  
	  if (maxTime < timestamp) {
		maxTime = timestamp;
	  }
  
	  sorted.push(timestamp);
	}
  
	if (sorted.length === 1) {
	  colorMap.set(sorted[0], 0);
	  return colorMap;
	}
  
	sorted.sort((a, b) => a - b);
  
	for (let i = 0; i < sorted.length; i++) {
	  const timestamp = sorted[i];
  
	  const t0 = (timestamp - minTime) / (maxTime - minTime);
	  const t1 = i / (sorted.length - 1.0);
  
	  const t = t0 * t1 * t0 * t1 * t0 * t1;
	  colorMap.set(timestamp, Math.floor(t * 255));
	}
  
	return colorMap;
}

function getGitHistory(filename: string) {
	
	const repoRoot = getRepoRoot(filename);
	const relPath = filename.substring(repoRoot.length + 1);
	const gitCommand = "git";
	const args = "annotate -p -w --stat";

	const execSync = require('child_process').execSync;
	const command = `${gitCommand} ${args} ${relPath}`;
	const options = { cwd: repoRoot };
	const dirChar = process.platform === "win32" ? "\\" : "/";

	const history = execSync(command, options).toString().trim();
	const commandOutput = history.split('\n');

	const lines: LineFile[] = [];
	const commits: Map<string, Change> = new Map();
	
	let firstLine = true;
	let currentCommit: Change = new Change();
		
	for (const output of commandOutput) {
	  if (output.length === 0) {
		continue;
	  }
	
	  if (output[0] !== '\t') {
		const space = output.indexOf(' ');
		if (space < 0) { 
			continue;
		}
	
		const left = output.substring(0, space);
		const right = output.substring(space + 1);
	
		// First line of info is always the hash with line numbers
		if (firstLine) {
		  const sha = left;
		  if (!commits.has(sha)) {
			currentCommit.sha = sha;
			commits.set(sha, currentCommit);
		  } else {
			currentCommit = commits.get(sha)!;
		  }
	
		  firstLine = false;
		  continue;
		}
	
		switch (left) {
		  case "committer-time":
			currentCommit.timestamp = parseInt(right, 10);
			break;
		  case "author":
			currentCommit.editor = right;
			break;
		  case "author-mail":
			currentCommit.editorEmail += right;
			break;
		  case "summary":
			currentCommit.comment = right;
			break;
		  case "filename":
			currentCommit.filename = dirChar !== '/' ? right.replace(/\//g, dirChar) : right;
			break;
		  default:
			// console.log(`? ${output}`);
			break;
		}
	  } else {
		let editor = currentCommit.editor;
		if (currentCommit.editorEmail.length > 0) {
		  editor += " " + currentCommit.editorEmail;
		}
	
		lines.push(new LineFile(
		  editor,
		  output.substring(1),
		  currentCommit.comment,
		  currentCommit.timestamp
		));
	
		firstLine = true;
		currentCommit = new Change();
	  }
	}
	
	const changes = Array.from(commits.values());
	changes.sort((a, b) => a.timestamp - b.timestamp);

	return { lines, changes };
}

function getRepoRoot(filename: string) {
	const execSync = require('child_process').execSync;
	const gitCommand = "git";
	const args = "rev-parse --show-toplevel";
	const options = { cwd: getDirname(filename) };

	return execSync(`${gitCommand} ${args}`, options).toString().trim();
}

function getDirname(filename: string) {
	const path = require('path');
	return path.dirname(filename);
}

// This method is called when your extension is deactivated
export function deactivate() {}
