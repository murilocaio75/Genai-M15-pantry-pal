import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  validatePantryDocument,
  type PantryDocument,
} from "../domain/pantry.ts";

export type { PantryDocument, PantryEntry } from "../domain/pantry.ts";

export interface PantryFileOperations {
  chmod: typeof chmod;
  mkdir: typeof mkdir;
  readFile: typeof readFile;
  writeFile: typeof writeFile;
  rename: typeof rename;
  unlink: typeof unlink;
}

const defaultFileOperations: PantryFileOperations = {
  chmod,
  mkdir,
  readFile,
  writeFile,
  rename,
  unlink,
};

function pantryDirectory(homeDirectory: string): string {
  return join(homeDirectory, ".pantry-pal");
}

function pantryFilePath(homeDirectory: string): string {
  return join(pantryDirectory(homeDirectory), "pantry.json");
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function parsePantryDocument(contents: string): PantryDocument {
  return validatePantryDocument(JSON.parse(contents) as unknown);
}

export async function loadPantry(
  homeDirectory: string = homedir(),
  operations: PantryFileOperations = defaultFileOperations,
): Promise<PantryDocument> {
  let contents: string;
  try {
    contents = await operations.readFile(pantryFilePath(homeDirectory), "utf8");
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return { items: [] };
    }
    throw error;
  }

  try {
    return parsePantryDocument(contents);
  } catch (error) {
    throw new Error(
      `Unable to read pantry data: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export async function savePantry(
  pantry: PantryDocument,
  homeDirectory: string = homedir(),
  operations: PantryFileOperations = defaultFileOperations,
  platform: string = process.platform,
): Promise<void> {
  const directory = pantryDirectory(homeDirectory);
  const targetPath = pantryFilePath(homeDirectory);
  const temporaryPath = join(directory, `.pantry.json.${randomUUID()}.tmp`);
  const serialized = `${JSON.stringify(pantry, null, 2)}\n`;
  const isWindows = platform === "win32";

  await operations.mkdir(directory, {
    recursive: true,
    ...(isWindows ? {} : { mode: 0o700 }),
  });
  if (!isWindows) {
    await operations.chmod(directory, 0o700);
  }

  try {
    await operations.writeFile(temporaryPath, serialized, {
      encoding: "utf8",
      flag: "wx",
      flush: true,
      ...(isWindows ? {} : { mode: 0o600 }),
    });
    if (!isWindows) {
      await operations.chmod(temporaryPath, 0o600);
    }
    await operations.rename(temporaryPath, targetPath);
  } catch (error) {
    try {
      await operations.unlink(temporaryPath);
    } catch (cleanupError) {
      if (!hasErrorCode(cleanupError, "ENOENT")) {
        throw new Error(
          `Unable to save pantry data and unable to clean temporary file: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    }
    throw error;
  }
}
