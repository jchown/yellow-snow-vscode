import * as vscode from 'vscode';
import { readFile } from 'fs';
import { YellowSnowView } from './YellowSnowView';
import { GitHistory } from './GitHistory';
import { LineFile } from './LineFile';
import { ThemeID } from './ThemeID';
import { Theme } from './Theme';
import { Color } from './Color';

export class ViewerProvider implements vscode.CustomReadonlyEditorProvider<YellowSnowView> {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new ViewerProvider(context);
		return vscode.window.registerCustomEditorProvider(ViewerProvider.viewType, provider);
	}

	public static readonly viewType = 'yellowSnow.viewType';

	constructor(private readonly context: vscode.ExtensionContext) {
	}

	openCustomDocument(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken): vscode.CustomDocument | Thenable<vscode.CustomDocument> {
		return new YellowSnowView(uri);
	}

	resolveCustomEditor(document: YellowSnowView, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): void {
		webviewPanel.webview.options = {
			enableScripts: true,
		};

		webviewPanel.webview.html = this.getLoading();

		try {
			const gitHistory = new GitHistory(document.uri.fsPath);

			readFile(document.uri.fsPath, 'utf8', (err, data) => {
				webviewPanel.webview.html = this.getHtmlForWebview(data.split('\n'), gitHistory, webviewPanel.webview);
			});
		}
		catch (e) {
			console.log(e);

			webviewPanel.webview.html = `<html><body>Failed to load file: ${e}</body></html>`;
		}            
	}

	getLoading(): string {

		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Yellow Snow</title>
			<style>
				.loading {
					width: 100%;
					height: 60px;
					background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' version='1.1' width='575' height='6px'%3E %3Cstyle%3E circle { animation: ball 2.5s cubic-bezier(0.000, 1.000, 1.000, 0.000) infinite; fill: %23bbb; } %23balls { animation: balls 2.5s linear infinite; } %23circle2 { animation-delay: 0.1s; } %23circle3 { animation-delay: 0.2s; } %23circle4 { animation-delay: 0.3s; } %23circle5 { animation-delay: 0.4s; } @keyframes ball { from { transform: none; } 20% { transform: none; } 80% { transform: translateX(864px); } to { transform: translateX(864px); } } @keyframes balls { from { transform: translateX(-40px); } to { transform: translateX(30px); } } %3C/style%3E %3Cg id='balls'%3E %3Ccircle class='circle' id='circle1' cx='-115' cy='3' r='3'/%3E %3Ccircle class='circle' id='circle2' cx='-130' cy='3' r='3' /%3E %3Ccircle class='circle' id='circle3' cx='-145' cy='3' r='3' /%3E %3Ccircle class='circle' id='circle4' cx='-160' cy='3' r='3' /%3E %3Ccircle class='circle' id='circle5' cx='-175' cy='3' r='3' /%3E %3C/g%3E %3C/svg%3E") 50% no-repeat;
				}
			</style>
		</head>
		<body>
			<div class="loading">
				Loading...
			</div>
		</body>
		</html>`;		
	}

	private getHtmlForWebview(file: string[], gitHistory: GitHistory, webview: vscode.Webview): string {

		const colorMap = this.calculateColorMap(new Set(gitHistory.lines.map((line) => line.timestamp)));

		let extConfig = vscode.workspace.getConfiguration("yellowSnow");
		let themeID = extConfig.get<ThemeID>("theme") || ThemeID.YellowSnow;

		var theme = this.themes.get(themeID);
		if (theme === undefined || theme === null) {
			throw new Error(`Invalid theme: ${themeID}`);
		}

		var colors = "";
		for (var i = 0; i < 256; i++) {
			const fgCol = this.getFGColor(theme, i).toHex();
			const bgCol = this.getBGColor(theme, i).toHex();
			colors += `.color_${i} { color: ${fgCol}; background-color: ${bgCol}; }\n`;
		};

		var commits = "";
		for (var i = 0; i < gitHistory.changes.length; i++) {
			const change = gitHistory.changes[i];
			const timestamp = new Date(change.timestamp * 1000);
			const editor = this.escapeHtml(`${change.editor} ${change.editorEmail}`);
			const comment = this.escapeHtml(change.comment);
			commits += `
		<div class="tooltip" id="commit_${change.sha}">${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}
${editor}

${comment}
</div>`;
		};

		var lines = "", authors = "";
		for (var i = 0; i < gitHistory.lines.length; i++) {
			const line = gitHistory.lines[i];
			const timestamp = new Date(line.timestamp);
			lines += this.getHtml(line, colorMap);
			authors += `<div class='line commit commit_${gitHistory.lines[i].commit}'>${gitHistory.lines[i].author}</div>`;
		}

		const configuration = vscode.workspace.getConfiguration();
		const editorFontFamily = configuration.get('editor.fontFamily');
		const editorFontSize = configuration.get('editor.fontSize');
		const editorFontWeight = configuration.get('editor.fontWeight');
		const minimapBgCol = this.getBGColor(theme, 0).toHex();
		const minimapVisCol = theme.visCol;
		const tooltipFgCol = this.getFGColor(theme, 0).toHex();
		const tooltipBgCol = this.getBGColor(theme, 0).toHex();

		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Yellow Snow</title>
			<style>
				body {
					font-family: ${editorFontFamily};
					font-size: ${editorFontSize};
					font-weight: ${editorFontWeight};
					margin: 0;
					padding: 0;
					line-height: 1.4;
					overflow: hidden;
					background-color: ${minimapBgCol};
				}
				#container {
					display: flex;
					white-space: nowrap;
					height: 100vh;
					position: relative;
				}
				#content {
					flex-grow: 1;
					overflow: scroll;
					display: flex;
				}
				#authors {
					flex: 0 0 5em;
					overflow-x: hidden;
					height: fit-content;
				}
				#text {
					margin-left: 1em;
					flex: 1;
					height: fit-content;
				}
				#minimap_container {
					width: 120px;
					position: relative;
					transition: right 0.3s ease-in-out;
					transition: width 0.3s ease-in-out;
				}
				#minimap_container.hidden {
					width: 0px;
				}
				#minimap {
					width: 884px;
					overflow-x: hidden;
					transform: scale(0.125);
					transform-origin: 0 0;
				}
				#visible_region {
					position: absolute;
					background-color: ${minimapVisCol};
					pointer-events: none;
					left: 0;
					right: 0;
				}
				.tooltip {
					padding: 1em;
					position: absolute;
					display: none;
					min-width: 320px;
					color: ${tooltipFgCol};
					background-color: ${tooltipBgCol};
					white-space: pre;
					text-align: center;
					width: fit-content;
					border-radius: 10px;
					box-shadow: 0 0 10px rgba(0, 0, 0, 0.75);
				}
				.line {
					white-space: pre;
					margin: 0;
					padding: 0;
				}
				${colors}
			</style>
			<script>
				${this.getMinimapCode()}
			</script>
		</head>
		<body>
			<div id="container">
				<div id="content">
					<div id="authors">
						${authors}
					</div>
					<div id="text">
						${lines}
					</div>
				</div>
				<div id="minimap_container">
					<div id="minimap">
						${lines}
					</div>
					<div id="visible_region">
					</div>
				</div>
				${commits}
			</div>
			<script>
				updateMinimap();
				window.addEventListener('resize', updateMinimap);
				document.querySelector('#content').addEventListener('scroll', updateMinimap);
				${this.getToolipCode()}
			</script>
		</body>
		</html>`;
	}

	getMinimapCode(): string {
		return `
		function updateMinimap() {
			
			const contentContainer = document.querySelector('#content');
			const codeContainer = document.querySelector('#text');
			const minimapContainer = document.querySelector('#minimap_container');
			const minimap = document.querySelector('#minimap');
			const visibleRegion = document.querySelector('#visible_region');

			const totalCodeHeight = codeContainer.clientHeight;
			const minimapHeight = minimapContainer.clientHeight;

			const visibleTop = contentContainer.scrollTop;
			const visibleBottom = contentContainer.scrollHeight - (visibleTop + contentContainer.clientHeight);

			const zoomFactor = minimapHeight / totalCodeHeight;

			if (zoomFactor < 1) {
				minimap.style.transform = "scale(" + zoomFactor + ")";
				visibleRegion.style.top = parseInt(visibleTop * zoomFactor) + "px";
				visibleRegion.style.bottom = parseInt(visibleBottom * zoomFactor) + "px";

				if (minimapContainer.classList.contains('hidden') === true) {
					minimapContainer.classList.remove('hidden');
				}
			}
			else {
				if (minimapContainer.classList.contains('hidden') === false) {
					minimapContainer.classList.add('hidden');
				}
			}
		}`;
	}

	getToolipCode(): string {
		return `
		const triggers = document.querySelectorAll(".commit"); // Elements that trigger the tooltip
		triggers.forEach(trigger => {

			trigger.classList.forEach(c => {
				
				if (!c.startsWith("commit_"))
					return;

				const tooltip = document.getElementById(c);
				trigger.addEventListener("mouseenter", () => {

					const triggerRect = trigger.getBoundingClientRect();
					const tooltipRect = tooltip.getBoundingClientRect();
					const viewportWidth = window.innerWidth;
					const viewportHeight = window.innerHeight;

					let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2 + 40;
					let top = triggerRect.top - tooltipRect.height - 10;

					if (left < 0) {
						left = 0;
					}
					if (left + tooltipRect.width > viewportWidth) {
						left = viewportWidth - tooltipRect.width;
					}
					if (top < 10) {
						top = 10;
					}
					if (top + 120 > viewportHeight) {
						top = viewportHeight - 120;
					}

					tooltip.style.left = left + "px";
					tooltip.style.top = top + "px";
					tooltip.style.display = "block"; 
				});

				trigger.addEventListener("mouseleave", () => {
					tooltip.style.display = "none";
				});
			});
		});`;
	}

	getHtml(line: LineFile, colorMap: Map<number, number>): string {
		
		const text = /\S/.test(line.source) ? line.source : " ";
		const color = colorMap.get(line.timestamp) || 0;

		return `<div class='color_${color} line'>${this.escapeHtml(text)}</div>`;
	}

	escapeHtml(unsafe: string): string {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/\t/g, "    ")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	themes = new Map<ThemeID, Theme>([
		[ThemeID.YellowSnow, new Theme("YS", new Color(0, 0, 0), new Color(0, 0, 0), new Color(255, 255, 255), new Color(255, 255, 0), "rgba(0, 123, 255, 0.3)")],
		[ThemeID.PurpleStain, new Theme("PS", new Color(255, 255, 255), new Color(255, 255, 0), new Color(29, 12, 40), new Color(87, 38, 128), "rgba(0, 123, 255, 0.3)")]
	]);
	
	private getBGColor(theme: Theme, level: number) {
		var from = theme.bgOld;
		var to = theme.bgNew;
	
		return this.getColor(level, from, to);
	}
		
	private getFGColor(theme: Theme, level: number) {
		var from = theme.fgOld;
		var to = theme.fgNew;
	
		return this.getColor(level, from, to);
	}
		
	private getColor(level: number, from: Color, to: Color) {
	
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
	

	/// <summary>
	/// Calculate a color map from timestamp -> [0-255].
	/// </summary>

	private calculateColorMap(timestamps: Set<number>): Map<number, number> {

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
}
