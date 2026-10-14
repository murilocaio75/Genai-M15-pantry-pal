import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command, CommanderError } from "commander";
import { afterEach, describe, expect, it } from "vitest";
import { createProgram } from "../../src/cli.ts";
import type { PantryFileOperations } from "../../src/storage/pantry-file.ts";

const temporaryHomes: string[] = [];

async function createHome(): Promise<string> {
  const homeDirectory = await mkdtemp(join(tmpdir(), "pantry-pal-cli-test-"));
  temporaryHomes.push(homeDirectory);
  return homeDirectory;
}

function systemFileOperations(): PantryFileOperations {
  return { mkdir, readFile, writeFile, rename, unlink };
}

function createHarness(
  homeDirectory: string,
  options: { failWrite?: boolean; today?: string } = {},
) {
  let nextIdentifier = 1;
  const output = { stdout: "", stderr: "" };
  const operations = systemFileOperations();
  if (options.failWrite) {
    operations.writeFile = async () => {
      throw new Error("injected storage failure");
    };
  }

  const program = createProgram({
    homeDirectory,
    createId: () => `entry-${nextIdentifier++}`,
    fileOperations: operations,
    getToday: () => options.today ?? "2026-10-13",
    writeOut: (message) => {
      output.stdout += message;
    },
    writeErr: (message) => {
      output.stderr += message;
    },
  });
  program.exitOverride();
  program.configureOutput({
    writeOut: (message) => {
      output.stdout += message;
    },
    writeErr: (message) => {
      output.stderr += message;
    },
  });

  return {
    output,
    clearOutput: () => {
      output.stdout = "";
      output.stderr = "";
    },
    run: async (...arguments_: string[]): Promise<number> => {
      try {
        await program.parseAsync(["node", "pantry-pal", ...arguments_]);
        return 0;
      } catch (error) {
        if (error instanceof CommanderError) {
          return error.exitCode;
        }
        throw error;
      }
    },
  };
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

describe("Pantry Pal CLI stock commands", () => {
  it("adds duplicate entries separately, lists exact decimals, uses stock, and removes by ID", async () => {
    const homeDirectory = await createHome();
    const harness = createHarness(homeDirectory);

    expect(
      await harness.run(
        "add",
        "Milk",
        "--quantity",
        "0.3",
        "--unit",
        "kg",
        "--expires",
        "2026-10-20",
      ),
    ).toBe(0);
    expect(
      await harness.run(
        "add",
        "Milk",
        "--quantity",
        "0.3",
        "--unit",
        "kg",
        "--expires",
        "2026-10-20",
      ),
    ).toBe(0);
    expect(harness.output.stdout).toContain("entry-1");
    expect(harness.output.stdout).toContain("entry-2");

    harness.clearOutput();
    expect(await harness.run("use", "entry-1", "0.1")).toBe(0);
    expect(await harness.run("use", "entry-1", "0.1")).toBe(0);
    harness.clearOutput();
    expect(await harness.run("list")).toBe(0);
    const listedEntries = JSON.parse(harness.output.stdout) as Array<{
      id: string;
      quantity: string;
    }>;
    expect(listedEntries).toMatchObject([
      { id: "entry-1", quantity: "0.1" },
      { id: "entry-2", quantity: "0.3" },
    ]);

    harness.clearOutput();
    expect(await harness.run("use", "entry-2", "0.4")).not.toBe(0);
    expect(harness.output.stderr).toContain("exceed");
    harness.clearOutput();
    expect(await harness.run("remove", "entry-1")).toBe(0);
    harness.clearOutput();
    expect(await harness.run("list")).toBe(0);
    expect(JSON.parse(harness.output.stdout)).toMatchObject([
      { id: "entry-2", quantity: "0.3" },
    ]);
  });

  it("rejects invalid decimal arguments with stderr and a non-zero status", async () => {
    const harness = createHarness(await createHome());

    expect(
      await harness.run(
        "add",
        "Milk",
        "--quantity",
        "1e-2",
        "--unit",
        "L",
        "--expires",
        "2026-10-20",
      ),
    ).not.toBe(0);
    expect(harness.output.stderr).toContain("decimal");
    expect(harness.output.stdout).not.toContain("Added");
  });

  it("does not report success when persistence fails", async () => {
    const harness = createHarness(await createHome(), { failWrite: true });

    expect(
      await harness.run(
        "add",
        "Milk",
        "--quantity",
        "1.5",
        "--unit",
        "L",
        "--expires",
        "2026-10-20",
      ),
    ).not.toBe(0);
    expect(harness.output.stderr).toContain("injected storage failure");
    expect(harness.output.stdout).not.toContain("Added");
  });

  it("reports unknown entry IDs without changing pantry contents", async () => {
    const harness = createHarness(await createHome());

    expect(await harness.run("remove", "missing-id")).not.toBe(0);
    expect(harness.output.stderr).toContain("missing-id");
  });

  it("lists expired and expiring-soon entries using an injected today", async () => {
    const homeDirectory = await createHome();
    const harness = createHarness(homeDirectory, { today: "2026-10-13" });
    const entries = [
      { name: "Expired", expires: "2026-10-12" },
      { name: "Today", expires: "2026-10-13" },
      { name: "Day seven", expires: "2026-10-20" },
      { name: "Day eight", expires: "2026-10-21" },
    ];

    for (const entry of entries) {
      expect(
        await harness.run(
          "add",
          entry.name,
          "--quantity",
          "1",
          "--unit",
          "item",
          "--expires",
          entry.expires,
        ),
      ).toBe(0);
    }

    harness.clearOutput();
    expect(await harness.run("expiring")).toBe(0);
    const groups = JSON.parse(harness.output.stdout) as {
      expired: Array<{ name: string }>;
      expiringSoon: Array<{ name: string }>;
    };
    expect(groups.expired.map((entry) => entry.name)).toEqual(["Expired"]);
    expect(groups.expiringSoon.map((entry) => entry.name)).toEqual([
      "Today",
      "Day seven",
    ]);
    expect(groups.expiringSoon.map((entry) => entry.name)).not.toContain(
      "Expired",
    );
  });

  it("returns empty expiry groups and reports malformed pantry data", async () => {
    const homeDirectory = await createHome();
    const harness = createHarness(homeDirectory, { today: "2026-10-13" });

    expect(await harness.run("expiring")).toBe(0);
    expect(JSON.parse(harness.output.stdout)).toEqual({
      expired: [],
      expiringSoon: [],
    });

    await mkdir(join(homeDirectory, ".pantry-pal"), { recursive: true });
    await writeFile(
      join(homeDirectory, ".pantry-pal", "pantry.json"),
      "{invalid",
    );
    harness.clearOutput();
    expect(await harness.run("expiring")).not.toBe(0);
    expect(harness.output.stderr).toContain("Unable to read pantry data");
  });

  it("lists only entries at or below configured exact minimums", async () => {
    const harness = createHarness(await createHome());
    const entries = [
      { name: "Below", quantity: "0.2", minimum: "0.3" },
      { name: "Equal", quantity: "0.30", minimum: "0.3" },
      { name: "Above", quantity: "0.4", minimum: "0.3" },
      { name: "Unset", quantity: "0.1" },
    ];

    for (const entry of entries) {
      const args = [
        "add",
        entry.name,
        "--quantity",
        entry.quantity,
        "--unit",
        "kg",
        "--expires",
        "2026-10-20",
      ];
      if (entry.minimum !== undefined) {
        args.push("--minimum", entry.minimum);
      }
      expect(await harness.run(...args)).toBe(0);
    }

    harness.clearOutput();
    expect(await harness.run("shop")).toBe(0);
    const shoppingEntries = JSON.parse(harness.output.stdout) as Array<{
      name: string;
      quantity: string;
      minimumQuantity: string;
    }>;
    expect(shoppingEntries.map((entry) => entry.name)).toEqual([
      "Below",
      "Equal",
    ]);
    expect(shoppingEntries[1]).toMatchObject({
      quantity: "0.3",
      minimumQuantity: "0.3",
    });
  });

  it("sets, changes, and clears a minimum through shop subcommands", async () => {
    const harness = createHarness(await createHome());

    expect(
      await harness.run(
        "add",
        "Rice",
        "--quantity",
        "0.2",
        "--unit",
        "kg",
        "--expires",
        "2026-10-20",
      ),
    ).toBe(0);

    harness.clearOutput();
    expect(await harness.run("shop", "set-minimum", "entry-1", "0.3")).toBe(0);
    harness.clearOutput();
    expect(await harness.run("shop")).toBe(0);
    expect(JSON.parse(harness.output.stdout)).toMatchObject([
      { id: "entry-1", minimumQuantity: "0.3" },
    ]);

    harness.clearOutput();
    expect(await harness.run("shop", "set-minimum", "entry-1", "0.1")).toBe(0);
    harness.clearOutput();
    expect(await harness.run("shop")).toBe(0);
    expect(JSON.parse(harness.output.stdout)).toEqual([]);

    expect(
      await harness.run("shop", "set-minimum", "entry-1", "-0.1"),
    ).not.toBe(0);
    expect(await harness.run("shop", "set-minimum", "missing", "0.1")).not.toBe(
      0,
    );

    harness.clearOutput();
    expect(await harness.run("shop", "clear-minimum", "entry-1")).toBe(0);
    harness.clearOutput();
    expect(await harness.run("list")).toBe(0);
    expect(JSON.parse(harness.output.stdout)).toMatchObject([
      { id: "entry-1", quantity: "0.2" },
    ]);
    expect(JSON.parse(harness.output.stdout)[0]).not.toHaveProperty(
      "minimumQuantity",
    );
  });
});
