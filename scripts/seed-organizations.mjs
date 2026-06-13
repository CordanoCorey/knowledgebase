import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

console.log("Seeding default organizations and temporary password users");

const seedResult = await runConvex(
  "seedOrganizationsAction:seedDefaultOrganizations",
  {},
  { push: true },
);
console.log(seedResult);

const verification = await runConvex(
  "seedOrganizations:verifyDefaultOrganizationsSeed",
  {},
  { push: false },
);
console.log(verification);

async function runConvex(functionName, args, options) {
  const jsonArgs = JSON.stringify(args);
  if (process.platform === "win32") {
    const escapedJsonArgs = jsonArgs.replace(/"/g, '\\"');
    const pushFlag = options.push ? " --push" : "";
    const { stderr, stdout } = await execAsync(
      `npx convex run ${functionName} "${escapedJsonArgs}"${pushFlag}`,
      {
        maxBuffer: 1024 * 1024 * 20,
      },
    );
    if (stderr.trim()) {
      process.stderr.write(stderr);
    }
    return stdout.trim();
  }

  const command = "npx";
  const commandArgs = ["convex", "run", functionName, jsonArgs];
  if (options.push) {
    commandArgs.push("--push");
  }

  const { stderr, stdout } = await execFileAsync(command, commandArgs, {
    maxBuffer: 1024 * 1024 * 20,
  });
  if (stderr.trim()) {
    process.stderr.write(stderr);
  }
  return stdout.trim();
}
