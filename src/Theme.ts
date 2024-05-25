import { Color } from './Color';
import { ThemeID } from './ThemeID';

export class Theme {
	id: string;
	fgOld: Color;
	fgNew: Color;
	bgOld: Color;
	bgNew: Color;
	visCol: String;
	tooltipBg: String;

	constructor(id: string, fgOld: Color, fgNew: Color, bgOld: Color, bgNew: Color, visCol: String, tooltipBg: String) {
		this.id = id;
		this.fgOld = fgOld;
		this.fgNew = fgNew;
		this.bgOld = bgOld;
		this.bgNew = bgNew;
		this.visCol = visCol;
		this.tooltipBg = tooltipBg;
	}

	static definitions = new Map<ThemeID, Theme>([
		[ThemeID.YellowSnow, new Theme("YS", new Color(0, 0, 0), new Color(0, 0, 0), new Color(255, 255, 255), new Color(255, 255, 0), "rgba(0, 123, 255, 0.3)", "azure")],
		[ThemeID.PurpleStain, new Theme("PS", new Color(255, 255, 255), new Color(255, 255, 0), new Color(29, 12, 40), new Color(87, 38, 128), "rgba(0, 123, 255, 0.3)", "#141852")]
	]);
}
