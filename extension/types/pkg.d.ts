

type PackageInfo = {
	name: string;
	displayName: string;
	description: string;
	version: string;
	license: string;
	publisher: string;
	author: string;
	engines: {
		vscode: string;
	};
	icon: string;
	galleryBanner: {
		color: string;
		theme: string;
	};
	categories: string[];
	keywords: string[];
	main: string;
	scripts: {
		[x: string]: string;
	};
	devDependencies: {
		[x: string]: string;
	};
	dependencies: {
		[x: string]: string;
	};
	activationEvents?: (string)[] | null;

	contributes: {
		commands: {
			command: string;
			title: string;
			category: string;
		}[];
		viewsContainers: {
			activitybar: {
				id: string;
				name: string;
				icon: string;
			}[];
		};
		views: {
			[x: string]: {
				id: string;
				name: string;
			}[];
		};
	};
}
