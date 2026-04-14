import type {
  InstallError,
  InstallErrorCode,
} from "../../src/install/errors.js";
import { isInstallErrorCode } from "../../src/install/errors.js";

export function expectInstallErrorCode<TCode extends InstallErrorCode>(
  code: TCode,
  assertError: (error: InstallError<TCode>) => void = () => {},
): (error: unknown) => boolean {
  return (error: unknown) => {
    if (!isInstallErrorCode(error, code)) {
      return false;
    }

    assertError(error);
    return true;
  };
}
