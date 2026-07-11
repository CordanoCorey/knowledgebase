export function getConvexDeploymentArgs(argv = process.argv.slice(2)) {
  const deploymentArgs = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--prod") {
      deploymentArgs.push("--prod");
      continue;
    }

    if (arg === "--deployment") {
      const deployment = argv[index + 1];
      if (!deployment) {
        throw new Error("Missing value for --deployment.");
      }
      deploymentArgs.push("--deployment", deployment);
      index += 1;
      continue;
    }

    if (arg.startsWith("--deployment=")) {
      const deployment = arg.slice("--deployment=".length);
      if (!deployment) {
        throw new Error("Missing value for --deployment.");
      }
      deploymentArgs.push("--deployment", deployment);
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      console.log("Usage: npm run seed:<name> -- [--deployment dev|prod|local]");
      process.exit(0);
    }

    throw new Error(`Unknown seed script argument: ${arg}`);
  }

  return deploymentArgs;
}

export function formatConvexArgsForWindowsShell(args) {
  return args.map((arg) => ` ${quoteForCmd(arg)}`).join("");
}

export function isLocalConvexTarget(args, env = process.env) {
  const deploymentArgIndex = args.indexOf("--deployment");
  if (deploymentArgIndex !== -1) {
    return isLocalDeploymentName(args[deploymentArgIndex + 1] ?? "");
  }

  if (args.includes("--prod")) {
    return false;
  }

  return isLocalDeploymentName(env.CONVEX_DEPLOYMENT ?? "");
}

export function shouldPushWithConvexRun(args, env = process.env) {
  if (env.CONVEX_SEED_SKIP_PUSH === "1") {
    return false;
  }

  return !isProdConvexTarget(args, env);
}

function isProdConvexTarget(args, env) {
  if (args.includes("--prod")) {
    return true;
  }

  const deploymentArgIndex = args.indexOf("--deployment");
  if (deploymentArgIndex !== -1) {
    return isProdDeploymentName(args[deploymentArgIndex + 1] ?? "");
  }

  return isProdDeploymentName(env.CONVEX_DEPLOYMENT ?? "");
}

function isLocalDeploymentName(value) {
  return (
    value === "local" ||
    value.startsWith("local:") ||
    value.startsWith("anonymous:") ||
    value.endsWith(":local")
  );
}

function isProdDeploymentName(value) {
  return (
    value === "prod" ||
    value === "production" ||
    value.startsWith("prod:") ||
    value.endsWith(":prod") ||
    value.endsWith(":production")
  );
}

function quoteForCmd(arg) {
  if (/^[A-Za-z0-9_:/.-]+$/.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/"/g, '\\"')}"`;
}
