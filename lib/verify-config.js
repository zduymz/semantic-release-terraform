import { isBoolean, isNil, isString } from "lodash-es";
import getError from "./get-error.js";

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
        ? [...errors, getError(`EINVALID${option.toUpperCase()}`, { [option]: value })]
        : errors,
    []
  );

  return errors;
}
