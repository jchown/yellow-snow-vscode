import { Change } from "./Change";
import { LineFile } from "./LineFile";

export class GitHistory {
    
    lines: LineFile[];
    changes: Change[];

    constructor(filename: string) {
	
        const repoRoot = this.getRepoRoot(filename);
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
    
        this.lines = lines;
        this.changes = changes;
    }
    

    getRepoRoot(filename: string): string {
        const execSync = require('child_process').execSync;
        const gitCommand = "git";
        const args = "rev-parse --show-toplevel";
        const options = { cwd: this.getDirname(filename) };

        return execSync(`${gitCommand} ${args}`, options).toString().trim();
    }

    getDirname(filename: string): string {
        const path = require('path');
        return path.dirname(filename);
    }

}