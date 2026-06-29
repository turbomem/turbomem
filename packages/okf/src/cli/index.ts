import { parseArgs } from "node:util";
import { parseBundle } from "../parser.js";
import { validateBundle } from "../validator.js";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean", short: "h" },
  },
});

const [command, target] = positionals;

if (!command || values.help) {
  console.log(`
okf — Open Knowledge Format CLI

Commands:
  okf validate <bundle-dir>   Validate an OKF bundle against the v0.1 spec
  okf parse <bundle-dir>      Parse and print bundle summary as JSON
`);
  process.exit(0);
}

if (command === "validate") {
  if (!target) {
    console.error("Usage: okf validate <bundle-dir>");
    process.exit(1);
  }

  const bundle = await parseBundle(target);
  const result = validateBundle(bundle);

  if (result.valid) {
    console.log(`✓ Bundle is valid (${bundle.documents.length} documents)`);
  } else {
    console.error(`✗ Bundle has ${result.errors.length} error(s):`);
    for (const err of result.errors) {
      console.error(`  [${err.rule}] ${err.path}: ${err.message}`);
    }
  }

  if (result.warnings.length > 0) {
    console.warn(`  ${result.warnings.length} warning(s):`);
    for (const w of result.warnings) {
      console.warn(`  [${w.rule}] ${w.path}: ${w.message}`);
    }
  }

  process.exit(result.valid ? 0 : 1);
}

if (command === "parse") {
  if (!target) {
    console.error("Usage: okf parse <bundle-dir>");
    process.exit(1);
  }

  const bundle = await parseBundle(target);
  console.log(
    JSON.stringify(
      {
        root: bundle.root,
        documentCount: bundle.documents.length,
        documents: bundle.documents.map((d) => ({
          path: d.relativePath,
          type: d.frontmatter.type,
          title: d.frontmatter.title,
          linkCount: d.links.length,
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
process.exit(1);
