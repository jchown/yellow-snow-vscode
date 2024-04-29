export class Change {
	sha?: string;
	timestamp: number = 0;
	comment: string = "";
	editor: string = "";
	editorEmail: string = "";
	filename: string = ""; // So we can track renames
}
