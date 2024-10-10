import path from "path";

export default async function (pluginConfig, pkg, context) {
  const {
    cwd,
    env: { TFC_TOKEN, GITHUB_SHA },
    logger,
  } = context;

  const { orgName, publish, pkgRoot } = pluginConfig;

  if (publish === false) {
    logger.log("Skip publishing to terraform registry");
    return true;
  }

  const name = pkg.name;
  const version = pkg.version;
  const registry = "https://app.terraform.io";
  const organization_name = pkg.org_name ? pkg.org_name : orgName;
  const namespace = organization_name;
  const registry_name = "private";
  const provider = pkg.provider ? pkg.provider : "undefined";

  const module_url = `${registry}/api/v2/organizations/${organization_name}/registry-modules/${registry_name}/${namespace}/name/${provider}`;
  const module_version_url = `${module_url}/versions`;
  const register_module_url = `${registry}/api/v2/organizations/${organization_name}/registry-modules`;

  const basePath = pkgRoot ? path.resolve(cwd, pkgRoot) : cwd;
  // const registry = getRegistry(pkg, context);
  // const distTag = getChannel(channel);
  logger.log(`Compress module ${compressName}`);
  await compress_module(cwd, context.env, basePath, `${name}-${version}.tgz`);

  const module = await get_module(module_version_url, TFC_TOKEN);
  if (module === null) {
    logger.log(`Create module ${name}`);
    await create_module(register_module_url, name, provider, TFC_TOKEN);
  }

  logger.log(`Create module ${name}@${version}`);
  const releaseInfo = await create_module_version(url, version, GITHUB_SHA, TFC_TOKEN);
  const upload_link = releaseInfo.data.links.upload;

  logger.log(`Uploading module ${name}@${version}`);
  await upload_module(upload_link, path.join(basePath, `${name}-${version}.tgz`));

  logger.log(`Published ${name}@${version}`);

  return get_module(module_version_url, TFC_TOKEN);
}

const create_module = async (url, name, provider, token) => {
  const payload = {
    data: {
      type: "registry-modules",
      attributes: {
        name: name,
        provider: provider,
        "registry-name": "private",
        "no-code": true,
      },
    },
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      throw new SemanticReleaseError(
        `HTTP error: ${resp.statusText}`,
        "HTTPERROR",
        `Response status: ${resp.status}, Response body: ${errorBody}`
      );
    }

    return await resp.json();
  } catch (err) {
    if (err instanceof SemanticReleaseError) {
      throw new AggregateError([err]);
    } else {
      throw new AggregateError([new SemanticReleaseError("Network error", "NETWORKERROR", err.message)]);
    }
  }
};

const get_module = async (url, token) => {
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/vnd.api+json",
      },
    });

    if (resp.ok) return await resp.json();
    if (resp.status === 404) return null;

    const errorBody = await resp.text();
    throw new SemanticReleaseError(
      `HTTP error: ${resp.statusText}`,
      "HTTPERROR",
      `Response status: ${resp.status}, Response body: ${errorBody}`
    );
  } catch (err) {
    if (err instanceof SemanticReleaseError) {
      throw new AggregateError([err]);
    } else {
      throw new AggregateError([new SemanticReleaseError("Network error", "NETWORKERROR", err.message)]);
    }
  }
};

const upload_module = async (url, tarball) => {
  const fileStream = fs.createReadStream(tarball);

  try {
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: fileStream,
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      throw new SemanticReleaseError(
        `HTTP error: ${resp.statusText}`,
        "HTTPERROR",
        `Response status: ${resp.status}, Response body: ${errorBody}`
      );
    }
  } catch (err) {
    if (err instanceof SemanticReleaseError) {
      throw new AggregateError([err]);
    } else {
      throw new AggregateError([new SemanticReleaseError("Network error", "NETWORKERROR", err.message)]);
    }
  }
};

const create_module_version = async (url, version, sha, token) => {
  const payload = {
    data: {
      type: "registry-module-versions",
      attributes: {
        version: version,
        "commit-sha": sha,
      },
    },
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      throw new SemanticReleaseError(
        `HTTP error: ${resp.statusText}`,
        "HTTPERROR",
        `Response status: ${resp.status}, Response body: ${errorBody}`
      );
    }

    return await resp.json();
  } catch (err) {
    if (err instanceof SemanticReleaseError) {
      throw new AggregateError([err]);
    } else {
      throw new AggregateError([new SemanticReleaseError("Network error", "NETWORKERROR", err.message)]);
    }
  }
};

const compress_module = async (cwd, env, basePath, compressName) => {
  const packResult = execa("tar", ["zcvf", compressName, path.join(basePath, "*")], { cwd, env, preferLocal: true });
  packResult.stdout.pipe(stdout, { end: false });
  packResult.stderr.pipe(stderr, { end: false });
};
