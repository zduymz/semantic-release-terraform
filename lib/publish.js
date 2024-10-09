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

  const [err, resp] = await fetch(url, {
    method: "POST",
    headers: {
      Bearer: `Bearer ${token}`,
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify(payload),
  });

  if (err) {
    throw new Error(`Network error: ${err}`);
  }
  if (!resp.ok) {
    throw new Error(`HTTP error! status: ${resp.status}`);
  }

  return resp.json();
};

const get_module = async (url, token) => {
  const [err, resp] = await fetch(url, {
    method: "GET",
    headers: {
      Bearer: `Bearer ${token}`,
      "Content-Type": "application/vnd.api+json",
    },
  });
  if (err) {
    throw new Error(`Network error: ${err}`);
  }
  if (resp.ok) return resp.json();
  if (resp.status === 404) return null;
  if (!resp.ok) {
    throw new Error(`HTTP error! status: ${resp.status}`);
  }
};

const upload_module = async (url, tarball) => {
  const fileStream = fs.createReadStream(tarball);
  const [err, resp] = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: fileStream,
  });

  if (err) {
    throw new Error(`Network error: ${err}`);
  }

  if (!resp.ok) {
    throw new Error(`HTTP error! status: ${resp.status}`);
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

  const [err, resp] = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify(payload),
  });

  if (err) {
    throw new Error(`Network error: ${err}`);
  }

  if (!resp.ok) {
    throw new Error(`HTTP error! status: ${resp.status}`);
  }

  return resp.json();
};

const compress_module = async (cwd, env, basePath, compressName) => {
  const packResult = execa("tar", ["zcvf", compressName, path.join(basePath, "*")], { cwd, env, preferLocal: true });
  packResult.stdout.pipe(stdout, { end: false });
  packResult.stderr.pipe(stderr, { end: false });
};
