import SemanticReleaseError from "@semantic-release/error";
import { isBoolean, isNil, isString } from "lodash-es";

const isNonEmptyString = (value) => isString(value) && value.trim();

const VALIDATORS = {
  publish: isBoolean,
  orgName: isNonEmptyString,
  tarballDir: isNonEmptyString,
  pkgRoot: isNonEmptyString,
};

export default function ({ publish, tarballDir, pkgRoot }) {
  const errors = Object.entries({ publish, tarballDir, pkgRoot }).reduce(
    (errors, [option, value]) =>
      !isNil(value) && !VALIDATORS[option](value)
        ? [...errors, new SemanticReleaseError("invalid config", "INVALIDCONFIG", "nothing")]
        : errors,
    []
  );

  return errors;
}
