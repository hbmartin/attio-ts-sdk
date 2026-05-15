import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as ts from "typescript";

const helperFiles = [
	"src/attio/lists.ts",
	"src/attio/metadata.ts",
	"src/attio/notes.ts",
	"src/attio/objects.ts",
	"src/attio/records.ts",
	"src/attio/search.ts",
	"src/attio/sdk.ts",
	"src/attio/tasks.ts",
	"src/attio/workspace-members.ts",
];

const schemaWrapperFiles = new Set([
	"src/attio/lists.ts",
	"src/attio/notes.ts",
	"src/attio/objects.ts",
	"src/attio/tasks.ts",
]);

const schemaDirectUnwrapFiles = new Set([
	"src/attio/metadata.ts",
	"src/attio/notes.ts",
	"src/attio/tasks.ts",
]);

const failures = [];
let optionsChecked = 0;
let overloadGroupsChecked = 0;
let schemaCallsChecked = 0;

function readSource(file) {
	const absolutePath = join(process.cwd(), file);
	const text = readFileSync(absolutePath, "utf8");
	const sourceFile = ts.createSourceFile(
		file,
		text,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	return { file, sourceFile };
}

function nodeLocation(sourceFile, node) {
	const position = sourceFile.getLineAndCharacterOfPosition(
		node.getStart(sourceFile),
	);
	return `${sourceFile.fileName}:${position.line + 1}:${position.character + 1}`;
}

function addFailure(sourceFile, node, message) {
	failures.push(`${nodeLocation(sourceFile, node)} ${message}`);
}

function walk(node, visit) {
	visit(node);
	ts.forEachChild(node, (child) => walk(child, visit));
}

function propertyNameText(name) {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
		return name.text;
	}
	return;
}

function checkOptionsContracts(sourceFile) {
	walk(sourceFile, (node) => {
		if (!ts.isPropertySignature(node)) {
			return;
		}

		if (propertyNameText(node.name) !== "options") {
			return;
		}

		optionsChecked += 1;
		const typeText = node.type?.getText(sourceFile) ?? "";
		if (!typeText.includes("Options<")) {
			addFailure(sourceFile, node, "options properties must derive from generated Options<TData>.");
		}
		if (!typeText.includes("Omit<")) {
			addFailure(sourceFile, node, "options properties must omit generated transport fields.");
		}
		if (!typeText.includes('"client"')) {
			addFailure(sourceFile, node, 'options properties must omit "client".');
		}
	});
}

function functionScopeName(node) {
	const names = [];
	let parent = node.parent;
	while (parent) {
		if (ts.isFunctionDeclaration(parent) && parent.name) {
			names.unshift(parent.name.text);
		}
		parent = parent.parent;
	}
	return `${names.join(".")}:${node.name?.text ?? "<anonymous>"}`;
}

function parameterName(parameter) {
	if (ts.isIdentifier(parameter.name)) {
		return parameter.name.text;
	}
	return parameter.name.getText();
}

function checkOverloadContracts(sourceFile) {
	const declarations = new Map();

	walk(sourceFile, (node) => {
		if (!(ts.isFunctionDeclaration(node) && node.name)) {
			return;
		}

		const key = functionScopeName(node);
		const existing = declarations.get(key) ?? [];
		existing.push(node);
		declarations.set(key, existing);
	});

	for (const group of declarations.values()) {
		if (group.length < 2) {
			continue;
		}

		overloadGroupsChecked += 1;
		const implementations = group.filter((node) => node.body);
		if (implementations.length !== 1) {
			addFailure(
				sourceFile,
				group[0],
				"overload groups must have exactly one implementation signature.",
			);
			continue;
		}

		const implementation = implementations[0];
		const parameterCount = implementation.parameters.length;
		const names = implementation.parameters.map(parameterName);

		for (const overload of group) {
			if (overload === implementation) {
				continue;
			}
			if (overload.parameters.length !== parameterCount) {
				addFailure(sourceFile, overload, "overload parameter counts must match the implementation.");
			}

			const overloadNames = overload.parameters.map(parameterName);
			if (overloadNames.join(",") !== names.join(",")) {
				addFailure(sourceFile, overload, "overload parameter names must match the implementation.");
			}
		}
	}
}

function isIdentifierCall(node, names) {
	return ts.isIdentifier(node.expression) && names.has(node.expression.text);
}

function argumentHasSchema(sourceFile, argument) {
	return argument.getText(sourceFile).includes("schema");
}

function checkSchemaContracts(sourceFile) {
	const requireWrapperSchemas = schemaWrapperFiles.has(sourceFile.fileName);
	const requireDirectSchemas = schemaDirectUnwrapFiles.has(sourceFile.fileName);

	walk(sourceFile, (node) => {
		if (!ts.isCallExpression(node)) {
			return;
		}

		if (
			requireWrapperSchemas &&
			isIdentifierCall(node, new Set(["callAndUnwrapData", "callAndUnwrapItems"]))
		) {
			schemaCallsChecked += 1;
			const schemaArgument = node.arguments[2];
			if (!schemaArgument || !argumentHasSchema(sourceFile, schemaArgument)) {
				addFailure(sourceFile, node, "schema-aware operation wrappers must pass a schema option.");
			}
		}

		if (
			requireDirectSchemas &&
			isIdentifierCall(node, new Set(["unwrapData", "unwrapItems"]))
		) {
			schemaCallsChecked += 1;
			const schemaArgument = node.arguments[1];
			if (!schemaArgument || !argumentHasSchema(sourceFile, schemaArgument)) {
				addFailure(sourceFile, node, "direct response unwraps in helper modules must pass a schema option.");
			}
		}
	});
}

for (const file of helperFiles) {
	const { sourceFile } = readSource(file);
	checkOptionsContracts(sourceFile);
	checkOverloadContracts(sourceFile);
	checkSchemaContracts(sourceFile);
}

if (failures.length > 0) {
	console.error("Contract lint failed:");
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exitCode = 1;
} else {
	console.log(
		[
			"Contract lint passed",
			`options=${optionsChecked}`,
			`overloads=${overloadGroupsChecked}`,
			`schemaCalls=${schemaCallsChecked}`,
		].join(" "),
	);
}
