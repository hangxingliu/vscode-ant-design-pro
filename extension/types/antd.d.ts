type AntdModuleParserResult = {
	ok: bool;
	file: string;
	namespace: string;
	states: ParseNamedLocation[];
	effects: ParseNamedLocation[];
	reducers: ParseNamedLocation[];
};

type ParseNamedLocation = {
	name: string;
	extra?: any;

	from: ParseLocation;
	to: ParseLocation;
};

type ParseLocation = {
	offset: number; character: number; line: number
}
