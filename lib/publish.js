import SemanticReleaseError from "@semantic-release/error";
import { execa } from "execa";
import fs from "fs";
import path from "path";

export default async function (pluginConfig, pkg, context) {
  const {
    cwd,
    env: { TFC_TOKEN, GITHUB_SHA },
    logger,
    stdout,
    stderr,
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

  // /organizations/:organization_name/registry-modules/:registry_name/:namespace/:name/:provider/versions
  const module_url = `${registry}/api/v2/organizations/${organization_name}/registry-modules/${registry_name}/${namespace}/${name}/${provider}`;
  const module_version_url = `${module_url}/versions`;
  const register_module_url = `${registry}/api/v2/organizations/${organization_name}/registry-modules`;

  const basePath = pkgRoot ? path.resolve(cwd, pkgRoot) : cwd;

  try {
    logger.log(`Compress module ${name}@${version}`);
    await compress_module(cwd, context.env, basePath, `${name}-${version}.tgz`, stdout, stderr);

    // Check if module exists
    const modules = await list_modules(
      register_module_url,
      name,
      provider,
      registry_name,
      organization_name,
      TFC_TOKEN
    );

    if (modules.length === 0 || !modules.includes(name)) {
      logger.log(`Module "${name}" not found. Create module ${name}`);
      await create_module(register_module_url, name, provider, TFC_TOKEN);
    }

    // Create new module version
    logger.log(`Create module version ${name}@${version}`);
    const releaseInfo = await create_module_version(module_version_url, version, GITHUB_SHA, TFC_TOKEN);
    const upload_link = releaseInfo.data.links.upload;

    // Upload module
    logger.log(`Uploading module ${name}@${version}`);
    await upload_module(upload_link, path.join(basePath, `${name}-${version}.tgz`));

    // Verify
    logger.log(`Published ${name}@${version}`);
    return get_module(module_version_url, TFC_TOKEN);
  } catch (error) {
    throw new AggregateError([error]);
  }
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

    const a = await resp.json();
    console.log("create_module response:");
    console.log(a);
  } catch (err) {
    if (err instanceof SemanticReleaseError) {
      throw err;
    } else {
      throw new SemanticReleaseError("Network error", "NETWORKERROR", err.message);
    }
  }
};

const list_modules = async (url, name, provider, registry_name, organization_name, token) => {
  const newUrl = new URL(url);
  newUrl.searchParams.append("q", name);
  newUrl.searchParams.append("filter[provider]", provider);
  newUrl.searchParams.append("filter[registry_name]", registry_name);
  newUrl.searchParams.append("filter[organization_name]", organization_name);
  newUrl.searchParams.append("page[size]", "100");
  try {
    const resp = await fetch(newUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      throw new SemanticReleaseError(
        `HTTP error: ${resp.statusText}`,
        "HTTPERROR",
        `Response status: ${resp.status}, Response body: ${errorBody}`
      );
    }

    const result = await resp.json();
    const moduleNames = result.data.map((module) => module.attributes.name);
    console.log(moduleNames);
    return moduleNames;
  } catch (err) {
    if (err instanceof SemanticReleaseError) {
      throw err;
    } else {
      throw new SemanticReleaseError("Network error", "NETWORKERROR", err.message);
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
      throw err;
    } else {
      throw new SemanticReleaseError("Network error", "NETWORKERROR", err.message);
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
      duplex: "half",
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
      throw err;
    } else {
      throw new SemanticReleaseError("Network error", "NETWORKERROR", err.message);
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

  console.log(url);
  console.log(payload);
  console.log(token);

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
      throw err;
    } else {
      throw new SemanticReleaseError("Network error", "NETWORKERROR", err.message);
    }
  }
};

const compress_module = async (cwd, env, basePath, compressName, stdout, stderr) => {
  const result = execa("tar", ["zcvf", compressName, "-C", basePath, "."], { cwd, env, preferLocal: true });
  result.stdout.pipe(stdout, { end: false });
  result.stderr.pipe(stderr, { end: false });
  await result;
};
