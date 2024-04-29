import { Line } from './Line';

export class LineFile extends Line {
	author: string;
	email?: string;
	lineNo?: number;
	source: string;
	comment: string;

	constructor(author: string, source: string, comment: string, timestamp: number) {
		super();
		this.author = author;
		this.source = source;
		this.comment = comment;
		this.timestamp = timestamp;
	}
}
