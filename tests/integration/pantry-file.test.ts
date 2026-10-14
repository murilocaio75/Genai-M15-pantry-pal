import {
  mkdtemp,
  chmod,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
  mkdir,
  rename,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadPantry,
  savePantry,
  type PantryDocument,
  type PantryFileOperations,
} from "../../src/storage/pantry-file.ts";

const temporaryHomes: string[] = [];

async function createHome(): Promise<string> {
  const homeDirectory = await mkdtemp(join(tmpdir(), "pantry-pal-test-"));
  temporaryHomes.push(homeDirectory);
  return homeDirectory;
}

function fileOperations(
  overrides: Partial<PantryFileOperations> = {},
): PantryFileOperations {
  return { mkdir, chmod, readFile, writeFile, rename, unlink, ...overrides };
}

function pantryDocument(quantity = "1.5"): PantryDocument {
  return {
    items: [
      {
        id: "entry-1",
        name: "Milk",
        quantity,
        unit: "L",
        expiryDate: "2026-10-20",
        minimumQuantity: "0.5",
      },
    ],
  };
}

function pantryPath(homeDirectory: string): string {
  return join(homeDirectory, ".pantry-pal", "pantry.json");
}

afterEach(async () => {
  await Promise.all(
    temporaryHomes
      .splice(0)
      .map((homeDirectory) =>
        rm(homeDirectory, { recursive: true, force: true }),
      ),
  );
});

describe("pantry file adapter", () => {
  it("treats a missing pantry file as empty", async () => {
    const homeDirectory = await createHome();

    await expect(loadPantry(homeDirectory, fileOperations())).resolves.toEqual({
      items: [],
    });
  });

  it("round-trips exact decimal strings as JSON strings", async () => {
    const homeDirectory = await createHome();
    const pantry = pantryDocument("0.1");

    await savePantry(pantry, homeDirectory, fileOperations());

    await expect(loadPantry(homeDirectory, fileOperations())).resolves.toEqual(
      pantry,
    );
    await expect(
      readFile(pantryPath(homeDirectory), "utf8"),
    ).resolves.toContain('"quantity": "0.1"');
  });

  it("reports malformed JSON without overwriting the invalid file", async () => {
    const homeDirectory = await createHome();
    const targetPath = pantryPath(homeDirectory);
    await mkdir(join(homeDirectory, ".pantry-pal"), { recursive: true });
    await writeFile(targetPath, "{invalid json", "utf8");

    await expect(loadPantry(homeDirectory, fileOperations())).rejects.toThrow();
    await expect(readFile(targetPath, "utf8")).resolves.toBe("{invalid json");
  });

  it("replaces the pantry only after a successful save", async () => {
    const homeDirectory = await createHome();
    const originalPantry = pantryDocument("1.5");
    const replacementPantry = pantryDocument("0.1");
    await savePantry(originalPantry, homeDirectory, fileOperations());

    await savePantry(replacementPantry, homeDirectory, fileOperations());

    await expect(loadPantry(homeDirectory, fileOperations())).resolves.toEqual(
      replacementPantry,
    );
  });

  it("preserves the previous pantry and removes a partial temp file after a write failure", async () => {
    const homeDirectory = await createHome();
    const targetPath = pantryPath(homeDirectory);
    const originalPantry = pantryDocument("1.5");
    await savePantry(originalPantry, homeDirectory, fileOperations());
    const originalBytes = await readFile(targetPath);
    const operations = fileOperations({
      writeFile: async (path, _data, _options) => {
        await writeFile(path, "partial", { flag: "wx" });
        throw new Error("injected temp write failure");
      },
    });

    await expect(
      savePantry(pantryDocument("0.1"), homeDirectory, operations),
    ).rejects.toThrow("injected temp write failure");

    await expect(readFile(targetPath)).resolves.toEqual(originalBytes);
    await expect(readdir(join(homeDirectory, ".pantry-pal"))).resolves.toEqual([
      "pantry.json",
    ]);
  });

  it("preserves the previous pantry and removes the temp file after a rename failure", async () => {
    const homeDirectory = await createHome();
    const targetPath = pantryPath(homeDirectory);
    const originalPantry = pantryDocument("1.5");
    await savePantry(originalPantry, homeDirectory, fileOperations());
    const originalBytes = await readFile(targetPath);
    const operations = fileOperations({
      rename: async () => {
        throw new Error("injected rename failure");
      },
    });

    await expect(
      savePantry(pantryDocument("0.1"), homeDirectory, operations),
    ).rejects.toThrow("injected rename failure");

    await expect(readFile(targetPath)).resolves.toEqual(originalBytes);
    await expect(readdir(join(homeDirectory, ".pantry-pal"))).resolves.toEqual([
      "pantry.json",
    ]);
  });

  it("applies owner-only POSIX modes to the pantry directory and files", async () => {
    const homeDirectory = await createHome();
    const chmodCalls: Array<{ path: string; mode: number }> = [];
    const operations = fileOperations({
      chmod: async (path, mode) => {
        chmodCalls.push({ path: String(path), mode });
      },
    });

    await savePantry(pantryDocument(), homeDirectory, operations, "linux");

    expect(chmodCalls).toHaveLength(2);
    expect(chmodCalls[0]).toEqual({
      path: join(homeDirectory, ".pantry-pal"),
      mode: 0o700,
    });
    expect(chmodCalls[1]).toMatchObject({ mode: 0o600 });
    expect(chmodCalls[1].path).toMatch(/^.*\.pantry\.json\..+\.tmp$/);
  });

  it("keeps the pantry path under the supplied home for inherited Windows ACLs", async () => {
    const homeDirectory = await createHome();

    await savePantry(
      pantryDocument(),
      homeDirectory,
      fileOperations(),
      "win32",
    );

    expect(
      relative(homeDirectory, pantryPath(homeDirectory)).startsWith(".."),
    ).toBe(false);
  });

  it("sets actual POSIX pantry directory and file modes to owner-only", async () => {
    const homeDirectory = await createHome();

    await savePantry(pantryDocument(), homeDirectory, fileOperations());

    if (process.platform === "win32") {
      return;
    }

    const directoryMode =
      (await stat(join(homeDirectory, ".pantry-pal"))).mode & 0o777;
    const fileMode = (await stat(pantryPath(homeDirectory))).mode & 0o777;
    expect(directoryMode).toBe(0o700);
    expect(fileMode).toBe(0o600);
  });
});
