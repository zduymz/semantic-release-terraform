import SemanticReleaseError from "@semantic-release/error";
import AggregateError from "aggregate-error";
import path from "path";
import { readPackage } from "read-pkg";

export default async function ({ pkgRoot }, { cwd }) {
  try {
    const pkg = await readPackage({ cwd: pkgRoot ? path.resolve(cwd, String(pkgRoot)) : cwd });

    if (!pkg.name) {
      throw new SemanticReleaseError("name property in package.json is missing", "ENOPKGNAME", "nothing");
    }

    return pkg;
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new AggregateError([new SemanticReleaseError("package.json missing", "ENOPKG", "nothing")]);
    }

    throw new AggregateError([error]);
  }
}
