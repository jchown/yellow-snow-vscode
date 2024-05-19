import { Color } from './Color';

export class Theme {
	id: string;
	fgOld: Color;
	fgNew: Color;
	bgOld: Color;
	bgNew: Color;
	visCol: String;

	constructor(id: string, fgOld: Color, fgNew: Color, bgOld: Color, bgNew: Color, visCol: String) {
		this.id = id;
		this.fgOld = fgOld;
		this.fgNew = fgNew;
		this.bgOld = bgOld;
		this.bgNew = bgNew;
		this.visCol = visCol;
	}
}
