import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const SCHEMA_PATH = join(
	process.cwd(),
	"node_modules/@biomejs/biome/configuration_schema.json",
);
const CONFIG_PATH = join(process.cwd(), "biome.jsonc");

interface CliOptions {
	ignoreGroups: string[];
	ignoreRules: string[];
}

function parseCliArgs(): CliOptions {
	const { values } = parseArgs({
		options: {
			"ignore-groups": {
				type: "string",
				multiple: true,
				default: [],
			},
			"ignore-rules": {
				type: "string",
				multiple: true,
				default: [],
			},
		},
	});

	return {
		ignoreGroups: values["ignore-groups"] ?? [],
		ignoreRules: (values["ignore-rules"] ?? []).map((r) => r.toLowerCase()),
	};
}

// Rule groups in the schema (the keys used in biome.jsonc) mapped to their $defs names
const RULE_GROUPS: Record<string, string> = {
	a11y: "A11y",
	complexity: "Complexity",
	correctness: "Correctness",
	nursery: "Nursery",
	performance: "Performance",
	security: "Security",
	style: "Style",
	suspicious: "Suspicious",
};

interface BiomeSchema {
	$defs?: Record<string, { properties?: Record<string, unknown> }>;
}

interface BiomeConfig {
	linter?: {
		rules?: Record<string, Record<string, string>>;
	};
}

function readSchema(): BiomeSchema {
	return JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));
}

function stripJsonComments(input: string): string {
	let result = "";
	let i = 0;
	const len = input.length;

	while (i < len) {
		const char = input[i];

		// Handle strings - preserve everything inside quotes
		if (char === '"') {
			result += char;
			i += 1;
			while (i < len) {
				const stringChar = input[i];
				result += stringChar;
				if (stringChar === "\\") {
					// Escape sequence - include next char
					i += 1;
					if (i < len) {
						result += input[i];
					}
				} else if (stringChar === '"') {
					break;
				}
				i += 1;
			}
			i += 1;
			continue;
		}

		// Handle single-line comments
		if (char === "/" && input[i + 1] === "/") {
			// Skip until end of line
			while (i < len && input[i] !== "\n") {
				i += 1;
			}
			continue;
		}

		// Handle multi-line comments
		if (char === "/" && input[i + 1] === "*") {
			i += 2;
			while (i < len - 1 && !(input[i] === "*" && input[i + 1] === "/")) {
				i += 1;
			}
			i += 2; // Skip closing */
			continue;
		}

		result += char;
		i += 1;
	}

	return result;
}

function readConfig(): BiomeConfig {
	const configContent = readFileSync(CONFIG_PATH, "utf-8");
	const configWithoutComments = stripJsonComments(configContent);
	return JSON.parse(configWithoutComments);
}

function collectAllRules(
	defs: NonNullable<BiomeSchema["$defs"]>,
	options: CliOptions,
): Record<string, string[]> {
	const allRules: Record<string, string[]> = {};

	for (const [groupKey, defName] of Object.entries(RULE_GROUPS)) {
		if (options.ignoreGroups.includes(groupKey)) {
			console.log(`${groupKey}: skipped (ignored)`);
			continue;
		}

		const groupDef = defs[defName];
		if (!groupDef?.properties) {
			console.log(`Warning: No definition found for ${defName}`);
			continue;
		}

		const rules = Object.keys(groupDef.properties).filter((name) => {
			if (name === "recommended" || name === "all") {
				return false;
			}
			const lowerName = name.toLowerCase();
			return !options.ignoreRules.some((pattern) =>
				lowerName.includes(pattern),
			);
		});
		allRules[groupKey] = rules;
		console.log(`${groupKey}: ${rules.length} rules`);
	}

	return allRules;
}

function buildNewRules(
	allRules: Record<string, string[]>,
	currentRules: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> {
	const newRules: Record<string, Record<string, string>> = {};

	for (const [groupKey, rules] of Object.entries(allRules)) {
		const currentGroupRules = currentRules[groupKey] || {};
		const newGroupRules: Record<string, string> = {};

		for (const ruleName of rules) {
			if (!(ruleName in currentGroupRules)) {
				newGroupRules[ruleName] = "error";
			}
		}

		if (Object.keys(newGroupRules).length > 0) {
			newRules[groupKey] = newGroupRules;
		}
	}

	return newRules;
}

function logNewRules(newRules: Record<string, Record<string, string>>): void {
	for (const [groupKey, rules] of Object.entries(newRules)) {
		console.log(`\n${groupKey} - adding ${Object.keys(rules).length} rules:`);
		console.log(Object.keys(rules).join(", "));
	}
}

function mergeRules(
	config: BiomeConfig,
	newRules: Record<string, Record<string, string>>,
): BiomeConfig {
	config.linter ??= {};
	config.linter.rules ??= {};

	for (const [groupKey, rules] of Object.entries(newRules)) {
		config.linter.rules[groupKey] ??= {};
		Object.assign(config.linter.rules[groupKey], rules);
	}

	return config;
}

function countNewRules(
	newRules: Record<string, Record<string, string>>,
): number {
	return Object.values(newRules).reduce(
		(sum, group) => sum + Object.keys(group).length,
		0,
	);
}

function main(): void {
	const options = parseCliArgs();

	if (options.ignoreGroups.length > 0) {
		console.log(`Ignoring groups: ${options.ignoreGroups.join(", ")}`);
	}
	if (options.ignoreRules.length > 0) {
		console.log(`Ignoring rules matching: ${options.ignoreRules.join(", ")}`);
	}

	const schema = readSchema();
	const defs = schema.$defs ?? {};
	const allRules = collectAllRules(defs, options);

	const config = readConfig();
	const currentRules = config.linter?.rules ?? {};
	const newRules = buildNewRules(allRules, currentRules);

	logNewRules(newRules);
	const updatedConfig = mergeRules(config, newRules);

	const output = JSON.stringify(updatedConfig, null, 2);
	writeFileSync(CONFIG_PATH, output);

	console.log("\n\nUpdated biome.jsonc with all rules set to error");
	console.log("Total new rules added:", countNewRules(newRules));
}

main();
