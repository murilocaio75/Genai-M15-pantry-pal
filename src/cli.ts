#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import {
  addPantryEntry,
  classifyExpiry,
  clearMinimum,
  getShoppingList,
  reduceQuantity,
  removePantryEntry,
  setMinimum,
} from "./domain/pantry.ts";
import {
  loadPantry,
  savePantry,
  type PantryFileOperations,
} from "./storage/pantry-file.ts";

export interface CliDependencies {
  readonly homeDirectory: string;
  readonly createId?: () => string;
  readonly fileOperations?: PantryFileOperations;
  readonly getToday?: () => string;
  readonly writeOut?: (message: string) => void;
  readonly writeErr?: (message: string) => void;
}

export function createProgram(dependencies: CliDependencies): Command {
  const program = new Command()
    .name("pantry-pal")
    .description("Manage an offline household pantry")
    .version("1.0.0");

  const writeOut =
    dependencies.writeOut ??
    ((message: string) => process.stdout.write(message));
  const writeErr =
    dependencies.writeErr ??
    ((message: string) => process.stderr.write(message));
  const createId = dependencies.createId ?? randomUUID;
  const reportFailure = (error: unknown): never => {
    const message = error instanceof Error ? error.message : String(error);
    return program.error(message);
  };

  program.configureOutput({
    writeOut,
    writeErr,
    outputError: (message, write) => write(message),
  });

  program
    .command("add <name>")
    .requiredOption("--quantity <decimal>")
    .requiredOption("--unit <label>")
    .requiredOption("--expires <date>")
    .option("--minimum <decimal>")
    .description("Add a separate pantry entry")
    .action(
      async (
        name: string,
        options: {
          quantity: string;
          unit: string;
          expires: string;
          minimum?: string;
        },
      ) => {
        try {
          const pantry = await loadPantry(
            dependencies.homeDirectory,
            dependencies.fileOperations,
          );
          const updatedPantry = addPantryEntry(pantry, {
            id: createId(),
            name,
            quantity: options.quantity,
            unit: options.unit,
            expiryDate: options.expires,
            ...(options.minimum === undefined
              ? {}
              : { minimumQuantity: options.minimum }),
          });
          await savePantry(
            updatedPantry,
            dependencies.homeDirectory,
            dependencies.fileOperations,
          );
          const entry = updatedPantry.items[updatedPantry.items.length - 1];
          writeOut(`Added ${entry.name} (${entry.id})\n`);
        } catch (error) {
          reportFailure(error);
        }
      },
    );

  program
    .command("list")
    .description("List all pantry entries")
    .action(async () => {
      try {
        const pantry = await loadPantry(
          dependencies.homeDirectory,
          dependencies.fileOperations,
        );
        writeOut(`${JSON.stringify(pantry.items, null, 2)}\n`);
      } catch (error) {
        reportFailure(error);
      }
    });

  program
    .command("use <id> <decimal>")
    .description("Record a quantity used")
    .action(async (id: string, amount: string) => {
      try {
        const pantry = await loadPantry(
          dependencies.homeDirectory,
          dependencies.fileOperations,
        );
        const entryIndex = pantry.items.findIndex((entry) => entry.id === id);
        if (entryIndex < 0) {
          throw new Error(`No pantry entry exists with ID '${id}'.`);
        }
        const updatedEntry = reduceQuantity(pantry.items[entryIndex], amount);
        const items = pantry.items.map((entry, index) =>
          index === entryIndex ? updatedEntry : entry,
        );
        await savePantry(
          { items },
          dependencies.homeDirectory,
          dependencies.fileOperations,
        );
        writeOut(
          `Updated ${updatedEntry.id}: ${updatedEntry.quantity} ${updatedEntry.unit}\n`,
        );
      } catch (error) {
        reportFailure(error);
      }
    });

  program
    .command("remove <id>")
    .description("Remove a pantry entry by ID")
    .action(async (id: string) => {
      try {
        const pantry = await loadPantry(
          dependencies.homeDirectory,
          dependencies.fileOperations,
        );
        const updatedPantry = removePantryEntry(pantry, id);
        await savePantry(
          updatedPantry,
          dependencies.homeDirectory,
          dependencies.fileOperations,
        );
        writeOut(`Removed ${id}\n`);
      } catch (error) {
        reportFailure(error);
      }
    });

  program
    .command("expiring")
    .description("Show expired and expiring-soon pantry entries")
    .action(async () => {
      try {
        const pantry = await loadPantry(
          dependencies.homeDirectory,
          dependencies.fileOperations,
        );
        const today = dependencies.getToday?.() ?? localToday();
        const expired = [];
        const expiringSoon = [];

        for (const entry of pantry.items) {
          const classification = classifyExpiry(entry.expiryDate, today);
          if (classification === "expired") {
            expired.push(entry);
          } else if (classification === "expiring-soon") {
            expiringSoon.push(entry);
          }
        }

        writeOut(`${JSON.stringify({ expired, expiringSoon }, null, 2)}\n`);
      } catch (error) {
        reportFailure(error);
      }
    });

  const shop = program
    .command("shop")
    .description("List pantry entries at or below their minimum quantity")
    .action(async () => {
      try {
        const pantry = await loadPantry(
          dependencies.homeDirectory,
          dependencies.fileOperations,
        );
        writeOut(`${JSON.stringify(getShoppingList(pantry), null, 2)}\n`);
      } catch (error) {
        reportFailure(error);
      }
    });

  shop
    .command("set-minimum <id> <decimal>")
    .description("Set or change an entry's minimum quantity")
    .action(async (id: string, minimumQuantity: string) => {
      try {
        const pantry = await loadPantry(
          dependencies.homeDirectory,
          dependencies.fileOperations,
        );
        const updatedPantry = setMinimum(pantry, id, minimumQuantity);
        await savePantry(
          updatedPantry,
          dependencies.homeDirectory,
          dependencies.fileOperations,
        );
        writeOut(
          `Set minimum for ${id} to ${updatedPantry.items.find((entry) => entry.id === id)?.minimumQuantity}\n`,
        );
      } catch (error) {
        reportFailure(error);
      }
    });

  shop
    .command("clear-minimum <id>")
    .description("Clear an entry's minimum quantity")
    .action(async (id: string) => {
      try {
        const pantry = await loadPantry(
          dependencies.homeDirectory,
          dependencies.fileOperations,
        );
        const updatedPantry = clearMinimum(pantry, id);
        await savePantry(
          updatedPantry,
          dependencies.homeDirectory,
          dependencies.fileOperations,
        );
        writeOut(`Cleared minimum for ${id}\n`);
      } catch (error) {
        reportFailure(error);
      }
    });

  return program;
}

function localToday(): string {
  const date = new Date();
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function main(): Promise<void> {
  await createProgram({ homeDirectory: homedir() }).parseAsync(process.argv);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
