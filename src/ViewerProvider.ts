import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { YellowSnowView } from './YellowSnowView';
import { GitHistory } from './GitHistory';
import { LineFile } from './LineFile';
import { ThemeID } from './ThemeID';
import { TimelineMode } from './TimelineMode';
import { Theme } from './Theme';
import { Color } from './Color';

export class ViewerProvider implements vscode.CustomReadonlyEditorProvider<YellowSnowView> {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new ViewerProvider(context);
		return vscode.window.registerCustomEditorProvider(ViewerProvider.viewType, provider);
	}

	public static readonly viewType = 'yellowSnow.viewType';

	spinner: string;

	constructor(private readonly context: vscode.ExtensionContext) {

		const htmlFilePath = vscode.Uri.file(path.join(context.extensionPath, 'spinner.html'));

		this.spinner = fs.readFileSync(htmlFilePath.fsPath, 'utf8');
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
			const revisions: Record<string, GitHistory> = {};
			var index = gitHistory.changes.length - 1;

			fs.readFile(document.uri.fsPath, 'utf8', (err, data) => {
				webviewPanel.webview.html = this.getHtmlForWebview(data.split('\n'), gitHistory, webviewPanel.webview);

				const listener = webviewPanel.webview.onDidReceiveMessage(
					message => {
						switch (message.command) {
							case 'next':
							case 'prev':
								// Handle time change event
								// updateEditorContent(message.time);

								var nextIndex = index + (message.command === 'next' ? 1 : -1);
								if (nextIndex < 0 || nextIndex >= gitHistory.changes.length) {
									//	Do nothing
									return;
								}

								const percentage = this.show(gitHistory, revisions, nextIndex, webviewPanel.webview);
								
								webviewPanel.webview.postMessage({ type: 'setProgress', percentage: percentage });

								index = nextIndex;
								return;
							case 'seek':
								const value = message.value;

								const startTimestamp = gitHistory.changes[0].timestamp;
								const endTimestamp = gitHistory.changes[gitHistory.changes.length - 1].timestamp;
								const duration = endTimestamp - startTimestamp;

								// Find nearest timestamp

								var nextIndex = -1;
								var minDiff = 1 << 62;
								for (var i = 0; i < gitHistory.changes.length; i++) {
									const change = gitHistory.changes[i];
									const diff = Math.abs((change.timestamp - startTimestamp) / duration * 100 - value);
									if (diff < minDiff) {
										minDiff = diff;
										nextIndex = i;
									}
								}

								if (nextIndex !== index) {
									this.show(gitHistory, revisions, nextIndex, webviewPanel.webview);
									index = nextIndex;
								}
								return;
						}
					});
			});
		}
		catch (e) {
			console.log(e);

			webviewPanel.webview.html = `<html><body>Failed to load file: ${e}</body></html>`;
		}            
	}

	show(gitHistory: GitHistory, revisions: Record<string, GitHistory>, nextIndex: number, webview: vscode.Webview): number {

		const sha = gitHistory.getSha(nextIndex)!;
		if (revisions[sha] === undefined) {
			webview.postMessage({ type: 'showLoading' });
			revisions[sha] = new GitHistory(gitHistory.filename, gitHistory, sha);
			webview.postMessage({ type: 'hideLoading' });
		}

		const revision = revisions[sha];
		const commits = this.getCommitsHtml(revision);

		webview.postMessage({
			type: 'setContents',
			authors: revision.lines.map((line) => `<div class='line commit commit_${line.commit}'>${line.author}</div>`).join(''),
			lines: revision.lines.map((line, index) => this.getHtml(index, line, this.calculateColorMap(new Set(revision.lines.map((line) => line.timestamp)))).replace(/line_[0-9]+/g, `line_${index}`)).join(''),
			commits: commits
		});

		var startTimestamp = gitHistory.changes[0].timestamp;
		var endTimestamp = gitHistory.changes[gitHistory.changes.length - 1].timestamp;
		var duration = endTimestamp - startTimestamp;

		const change = gitHistory.changes[nextIndex];
		const percentage = (change.timestamp - startTimestamp) / duration * 100;

		return percentage;
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
					background: ${this.spinner};
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
		let themeID = extConfig.get<ThemeID>("theme") || ThemeID.Auto;
		let timelineMode = extConfig.get<TimelineMode>("timelineMode") || TimelineMode.Shown;

		if (themeID === ThemeID.Auto) {
			const themeName = vscode.window.activeColorTheme.kind;
			if (themeName === vscode.ColorThemeKind.Light) {
				themeID = ThemeID.YellowSnow;
			} else {
				themeID = ThemeID.PurpleStain;
			}
		}
		
		const theme = Theme.definitions.get(themeID);
		if (theme === undefined || theme === null) {
			throw new Error(`Invalid theme: ${themeID}`);
		}

		var colors = "";
		for (var i = 0; i < 256; i++) {
			const fgCol = this.getFGColor(theme, i).toHex();
			const bgCol = this.getBGColor(theme, i).toHex();
			colors += `.color_${i} { color: ${fgCol}; background-color: ${bgCol}; }\n`;
		};

		var commits = this.getCommitsHtml(gitHistory);
		var lines = this.getLinesHtml(gitHistory, colorMap, theme, commits);
		var authors = this.getAuthorsHtml(gitHistory);

		var startTimestamp = gitHistory.changes[0].timestamp;
		var endTimestamp = gitHistory.changes[gitHistory.changes.length - 1].timestamp;
		var duration = endTimestamp - startTimestamp;

		var timelineMarkers = {};
		var timelineMarkerPercentages = "";
		
		for (var i = 0; i < gitHistory.changes.length; i++) {
			const change = gitHistory.changes[i];
			const percentage = (change.timestamp - startTimestamp) / duration * 100;
			timelineMarkerPercentages += `${percentage},`;
		}

		const configuration = vscode.workspace.getConfiguration();
		const editorFontFamily = configuration.get('editor.fontFamily');
		const editorFontSize = configuration.get('editor.fontSize');
		const editorFontWeight = configuration.get('editor.fontWeight');
		const minimapBgCol = this.getBGColor(theme, 0).toHex();
		const minimapVisCol = theme.visCol;
		const tooltipFgCol = this.getFGColor(theme, 0).toHex();
		const tooltipBgCol = theme.tooltipBg;

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
					overflow-x: hidden;
					transform-origin: 0 0;
					user-select: none;
				}
				#visible_region {
					position: absolute;
					background-color: ${minimapVisCol};
					pointer-events: none;
					left: 0;
					right: 0;
				}
				#timeline_container {
					position: fixed;
					display: flex;
					flex-flow: row nowrap;
					bottom: 10px;
					left: 40%;
					transform: translateX(-50%);
					width: 60%;
					background-color: var(--vscode-editor-background);
					border: 1px solid var(--vscode-panel-border);
		            border-radius: 4px;
					padding: 0.5em;
					box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
					z-index: 1000;
					transition: bottom 0.3s ease-in-out;
				}
				#timeline_container.hidden {
					bottom: -100px;
				}
				#timeline_container_2 {
					flex: 1;
					padding: 0 1em;
    		    }
				.timeline_button {
					flex: 0 0 50px;
					background-color: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
					border: none;
					border-radius: 4px;
					padding: 5px 10px;
					cursor: pointer;
					font-size: 12px;
				}
				#timeline {
					flex: 1;
    		    }
		        #timeline_markers {
        		    position: relative;
		            height: 20px;
		        }
				.timeline_marker {
					position: absolute;
					width: 2px;
					height: 10px;
					background-color: var(--vscode-editor-foreground);
					bottom: 0;
				}
				#timeline_toggle {
					position: fixed;
					bottom: 10px;
					right: 10px;
					z-index: 1001;
					background-color: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
					border: none;
					border-radius: 4px;
					padding: 5px 10px;
					cursor: pointer;
					font-size: 12px;
					transition: background-color 0.3s ease;
				}
				#timeline_toggle:hover {
					background-color: var(--vscode-button-hoverBackground);
				}
				.tooltip {
					padding: 1em;
					position: absolute;
					display: none;
					color: ${tooltipFgCol};
					background-color: ${tooltipBgCol};
					white-space: pre;
					text-align: center;
					width: fit-content;
					min-width: 320px;
					border-radius: 10px;
					box-shadow: 0 0 10px rgba(0, 0, 0, 0.75);
				}
				.line {
					white-space: pre;
					margin: 0;
					padding: 0;
				}
				${colors}

				#loading-overlay {
					position: fixed;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background-color: var(--vscode-editor-background);
					opacity: 0.9;
					display: none;
					justify-content: center;
					align-items: center;
					z-index: 9999;
				}
		
				#loading-overlay.visible {
					display: flex;
				}
		
				.spinner-container {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 12px;
				}
		
				.spinner {
					animation: spin 1s linear infinite;
				}
		
				.spinner-text {
					color: var(--vscode-foreground);
					font-size: var(--vscode-font-size);
					font-family: var(--vscode-font-family);
				}
		
				@keyframes spin {
					100% {
						transform: rotate(360deg);
					}
				}
			</style>
			<script>
				${this.getMinimapCode()}
			</script>
		</head>
		<body>
		    <div id="loading-overlay">
				<div class="spinner-container">
					<i class="codicon codicon-loading spinner"></i>
					<span class="spinner-text">Processing...</span>
				</div>
			</div>
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
				<div id="commits">
					${commits}
				</div>	
			<div id="timeline_container" class="${timelineMode !== TimelineMode.Shown ? 'hidden':''}">
					<button id="timeline_prev" class="timeline_button" title="Previous">&lt;&lt;</button>
					<div id="timeline_container_2">
						<input type="range" id="timeline" min="0" max="100" value="100" style="width:100%">
						<div id="timeline_markers"></div>
					</div>
					<button id="timeline_next" class="timeline_button" title="Next">&gt;&gt;</button>
				</div>
				${timelineMode === TimelineMode.Hidden ? '<button id="timeline_toggle">&lt;</button>' : ''}
				${timelineMode === TimelineMode.Shown ? '<button id="timeline_toggle">Hide Timeline</button>' : ''}
			</div>
			<script>

				const vscode = acquireVsCodeApi();

				const timeline = document.getElementById('timeline');
				const timelineContainer = document.getElementById('timeline_container');
				const timelineMarkers = document.getElementById('timeline_markers');
				const timelineNext = document.getElementById('timeline_next');
				const timelinePrev = document.getElementById('timeline_prev');
				const toggleButton = document.getElementById('timeline_toggle');

				updateMinimap();
				window.addEventListener('resize', updateMinimap);
				document.querySelector('#content').addEventListener('scroll', updateMinimap);
				document.querySelectorAll('#minimap .line').forEach(line => {
					line.addEventListener('mousedown', panMinimapStart);
					line.addEventListener('mousemove', panMinimap);
					line.addEventListener('mouseup', panMinimapEnd);
				});
				document.querySelector('#minimap').addEventListener('mouseleave', panMinimapEnd);
				${this.getToolipCode()}

				let isVisible = ${timelineMode === TimelineMode.Shown ? 'true' : 'false'};
				if (toggleButton !== null) {
					toggleButton.addEventListener('click', () => {
						isVisible = !isVisible;
						timelineContainer.classList.toggle('hidden', !isVisible);
						toggleButton.textContent = isVisible ? 'Hide Timeline' : '<';
					});
				}		

				const events = [${timelineMarkerPercentages}];
				events.forEach(event => {
					const marker = document.createElement('div');
					marker.className = 'timeline_marker';
					marker.style.left = event + '%';
					timelineMarkers.appendChild(marker);
				});

				timelineNext.addEventListener('click', (event) => {
                	vscode.postMessage({ command: 'next' });
				});

				timelinePrev.addEventListener('click', (event) => {
					vscode.postMessage({ command: 'prev' });
				});
				
				timeline.addEventListener('input', (event) => {
					const value = parseInt(event.target.value);
					vscode.postMessage({
						command: 'seek',
						value: value
					});
				});

				function showLoading(message = 'Processing...') {
					const overlay = document.getElementById('loading-overlay');
					const text = overlay.querySelector('.spinner-text');
					text.textContent = message;
					overlay.classList.add('visible');
					
					document.querySelectorAll('button, input, select').forEach(element => {
						element.disabled = true;
					});
				}

				function hideLoading() {
					const overlay = document.getElementById('loading-overlay');
					overlay.classList.remove('visible');
					
					document.querySelectorAll('button, input, select').forEach(element => {
						element.disabled = false;
					});
				}

				function setProgress(percentage) {
					const timeline = document.getElementById('timeline');
					timeline.value = percentage;
				}

				window.addEventListener('message', event => {
					const message = event.data;
					switch (message.type) {
						case 'showLoading':
							showLoading(message.message);
							break;
						case 'hideLoading':
							hideLoading();
							break;
						case 'setProgress':
							setProgress(message.percentage);
							break;
						case 'setContents':
							document.querySelector('#authors').innerHTML = message.authors;
							document.querySelector('#text').innerHTML = message.lines;
							document.querySelector('#minimap').innerHTML = message.lines;
							document.querySelector('#commits').innerHTML = message.commits;
							updateMinimap();
							break;
					}
				});
			</script>
		</body>
		</html>`;
	}

	getCommitsHtml(gitHistory: GitHistory): string {
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

		return commits;
	}

	getAuthorsHtml(gitHistory: GitHistory): string {
		var authors = "";
		for (var i = 0; i < gitHistory.lines.length; i++) {
			const line = gitHistory.lines[i];
			const timestamp = new Date(line.timestamp);
			authors += `<div class='line commit commit_${gitHistory.lines[i].commit}'>${gitHistory.lines[i].author}</div>`;
		}
		return authors;
	}

	getLinesHtml(gitHistory: GitHistory, colorMap: Map<number, number>, theme: Theme, commits: string): string {
		var lines = "";
		for (var i = 0; i < gitHistory.lines.length; i++) {
			const line = gitHistory.lines[i];
			lines += this.getHtml(i, line, colorMap);
		}
		return lines;
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
				minimap.style.width = 120 / zoomFactor + "px";
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
		}

		var panning = false;

		function panMinimapStart(event) {
			panning = true;
			panMinimap(event);
		}

		function panMinimapEnd(event) {
			panning = false;
		}

		function panMinimap(event) {
			if (!panning)
				return;

			var line = event.target;
			line.classList.forEach(c => {
				if (!c.startsWith("line_"))
					return;
				const lineNumber = parseInt(c.substring(5));

				const content = document.querySelector('#content');
				const contentHeight = content.scrollHeight;

				var textLength = parseInt(document.querySelector('#text').childElementCount); 
				console.log("TL: " + textLength);

				content.scrollTop = Math.max(0, contentHeight * lineNumber / textLength - content.clientHeight / 2);
			});
		}
		`;
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

	getHtml(lineNumber: number, line: LineFile, colorMap: Map<number, number>): string {
		
		const text = /\S/.test(line.source) ? line.source : " ";
		const color = colorMap.get(line.timestamp) || 0;

		return `<div class='color_${color} line line_${lineNumber}'>${this.escapeHtml(text)}</div>`;
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
