import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const seedScripts = [
  "seed-organizations.mjs",
  "seed-scripture.mjs",
  "seed-literature.mjs",
];

for (const script of seedScripts) {
  await runSeedScript(script, process.argv.slice(2));
}

function runSeedScript(script, args) {
  const scriptPath = fileURLToPath(new URL(script, import.meta.url));
  console.log(`\n> node scripts/${script} ${args.join(" ")}`.trimEnd());

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${script} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`,
        ),
      );
    });
  });
}
