import { Line } from './Line';

export class LineFile extends Line {
	author: string;
	email?: string;
	source: string;
	comment: string;

	constructor(author: string, email: string, source: string, comment: string, timestamp: number, commit?: string) {
		super();
		this.author = author;
		this.email = email;
		this.source = source;
		this.comment = comment;
		this.timestamp = timestamp;		
		this.commit = commit;
	}	
}
