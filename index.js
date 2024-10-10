import AggregateError from "aggregate-error";
import { castArray, defaultTo } from "lodash-es";
import getPkg from "./lib/get-pkg.js";
import publishPackage from "./lib/publish.js";
import verifyAuth from "./lib/verify-auth.js";
import verifyConfig from "./lib/verify-config.js";

let verified;

// pluginConfig: { orgname: string, publish: bool, tarballDir: string }
export async function verifyConditions(pluginConfig, context) {
  if (!pluginConfig.hasOwnProperty("publish")) {
    pluginConfig.publish = true;
  }

  // i don't know what this does
  if (context.options.publish) {
    const publishPlugin =
      castArray(context.options.publish).find(
        (config) => config.path && config.path === "semantic-release-terraform"
      ) || {};
    console.log(publishPlugin);
    pluginConfig.orgName = defaultTo(pluginConfig.orgName, publishPlugin.orgName);
    pluginConfig.publish = defaultTo(pluginConfig.publish, publishPlugin.publish);
    pluginConfig.tarballDir = defaultTo(pluginConfig.tarballDir, publishPlugin.tarballDir);
    pluginConfig.pkgRoot = defaultTo(pluginConfig.pkgRoot, publishPlugin.pkgRoot);
  }

  const errors = verifyConfig(pluginConfig);

  try {
    // const pkg = await getPkg(pluginConfig, context);
    if (pluginConfig.publish !== false) {
      await verifyAuth(context);
    }
  } catch (error) {
    errors.push(...error.errors);
  }

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }

  verified = true;
}

export async function publish(pluginConfig, context) {
  const errors = verified ? [] : verifyConfig(pluginConfig);
  let pkg;
  try {
    // Reload package.json in case a previous external step updated it
    pkg = await getPkg(pluginConfig, context);
    if (!verified && pluginConfig.publish !== false) {
      await verifyAuth(context);
    }
  } catch (error) {
    errors.push(...error.errors);
  }

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }

  return publishPackage(pluginConfig, pkg, context);
}
