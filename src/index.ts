import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path, { parse } from "node:path";
import { Command, InvalidOptionArgumentError, Option } from "commander";

// types
type Expense = {
  id: number;
  description: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
};

//************************************************
//******************* const **********************
//************************************************
const DB_PATH = path.join(import.meta.dirname, "db.json");
const MONTHS = {
  1: "Janurary",
  2: "Februray",
  3: "March",
  4: "April",
  5: "May",
  6: "June",
  7: "July",
  8: "August",
  9: "September",
  10: "October",
  11: "November",
  12: "December",
};

//************************************************
//******************* Utils **********************
//************************************************

function parseNumber(value: string) {
  if (value === "true" || value === "false" || value === "") return NaN;

  return Number(value);
}

// query database
async function queryDatabase(path: string) {
  return await readFile(path, { encoding: "utf-8" });
}

// write to a database
async function writeDatabase(path: string, data: string) {
  return await writeFile(path, data);
}

// create a database
async function createDatabase(path: string) {
  return await writeFile(path, "[]");
}

function getMonth(date: Date, format: Intl.DateTimeFormatOptions["month"] = "short") {
  return date.toLocaleDateString(undefined, { month: format });
}

function getYear(date: Date, format: Intl.DateTimeFormatOptions["year"] = "numeric") {
  return date.toLocaleDateString(undefined, { year: format });
}

function getDay(date: Date, format: Intl.DateTimeFormatOptions["day"] = "2-digit") {
  return date.toLocaleDateString(undefined, { day: format });
}

//************************************************
//***************** Services *********************
//************************************************
type AddServiceProps = {
  description: string;
  amount: number;
};

async function addService(props: AddServiceProps): Promise<{ success: true; message: string } | { success: false; error: string }> {
  try {
    const json = await queryDatabase(DB_PATH);
    const data = JSON.parse(json) as Expense[];

    const lastItem = data.length > 0 ? data[data.length - 1] : undefined;
    const newExpenseId = lastItem ? lastItem.id + 1 : 1;

    const date = new Date().toISOString();

    const newExpense: Expense = {
      id: newExpenseId,
      description: props.description,
      amount: props.amount,
      createdAt: date,
      updatedAt: date,
    };

    const newDate = [...data, newExpense];

    await writeDatabase(DB_PATH, JSON.stringify(newDate));
    return { success: true, message: `Expense added successfully (ID: ${newExpense.id})` };
  } catch (error) {
    return { success: false, error: `Failed to create expense. Please try again.` };
  }
}

type UpdateServiceProps = {
  id: number;
  description?: string;
  amount?: number;
};

async function updateService(props: UpdateServiceProps): Promise<{ success: true; message: string } | { success: false; error: string }> {
  try {
    const json = await queryDatabase(DB_PATH);
    const data = JSON.parse(json) as Expense[];

    const expenseIndex = data.findIndex((exp) => exp.id === props.id);
    const expense = data[expenseIndex];

    if (!expense) {
      return { success: false, error: `Expense with ID = ${props.id} not found.` };
    }

    const date = new Date().toISOString();
    const updatedExpense: Expense = { ...expense, updatedAt: date };

    if (props.description) {
      updatedExpense["description"] = props.description;
    }
    if (props.amount) {
      updatedExpense["amount"] = props.amount;
    }

    const newDate = data.with(expenseIndex, updatedExpense);

    await writeDatabase(DB_PATH, JSON.stringify(newDate));
    return { success: true, message: `Expense with ID = ${props.id} updated successfully.` };
  } catch (error) {
    return { success: false, error: `Failed to updated expense. Please try again.` };
  }
}

async function listService() {
  const json = await queryDatabase(DB_PATH);
  const data = JSON.parse(json) as Expense[];

  console.log("\n***************** Expense List *****************\n");
  for (const expense of data) {
    const cat = new Date(expense.createdAt);
    const uat = new Date(expense.updatedAt);

    const createdAt = `${getDay(cat)} ${getMonth(cat)}, ${getYear(cat)}`;
    const updatedAt = `${getDay(uat)} ${getMonth(uat)}, ${getYear(uat)}`;

    console.log("Id: ", expense.id);
    console.log("Description: ", expense.description);
    console.log("Amount: ", expense.amount);
    console.log("Created At: ", createdAt);
    console.log("Updated At: ", updatedAt);
    console.log("\n**********************************\n");
  }
}

type DeleteServiceParams = {
  id: number;
};
async function deleteService(params: DeleteServiceParams) {
  try {
    const json = await queryDatabase(DB_PATH);
    const data = JSON.parse(json) as Expense[];
    const newData = data.filter((f) => f.id !== params.id);

    await writeDatabase(DB_PATH, JSON.stringify(newData));
    return { success: true, message: `Expense with ID = ${params.id} deleted successfully.` };
  } catch (error) {
    return { success: false, error: `Failed to delete expense. Please try again.` };
  }
}

type SummaryServiceParams = {
  month: number | undefined;
};
async function summaryService(
  params: SummaryServiceParams,
): Promise<{ success: true; data: { total: number; month: number | undefined } } | { success: false; error: string }> {
  try {
    const json = await queryDatabase(DB_PATH);
    const data = JSON.parse(json) as Expense[];

    let total = 0;

    for (const expense of data) {
      if (params.month) {
        const month = Number(getMonth(new Date(expense.createdAt), "numeric"));

        if (month === params.month) {
          total += expense.amount;
        }
      } else {
        total += expense.amount;
      }
    }

    return { success: true, data: { total, month: params.month } };
  } catch (error) {
    return { success: false, error: "Failed to get summary. Please try again." };
  }
}

//************************************************
//***************** Controllers ******************
//************************************************

function addCommand() {
  const command = new Command();
  command
    .name("add")
    .description("Add expense")
    .requiredOption("--description <string>", "Description of the expense")
    .requiredOption("--amount <number>", "Amount of the expense", (amount) => {
      const parsedAmount = Number(amount);
      if (Number.isNaN(parsedAmount)) {
        throw new InvalidOptionArgumentError("Amount must be a number");
      } else if (parsedAmount <= 0) {
        throw new InvalidOptionArgumentError("Amount must be greater than 0");
      }
      return parsedAmount;
    })
    .action(async (props) => {
      const result = await addService(props);

      if ("error" in result) {
        console.log(`Error:: ${result.error}`);
        return;
      }

      console.log(`Success: ${result.message}`);
    });

  return command;
}

function updateCommand() {
  const command = new Command("update");

  command
    .description("Update expense by id")
    .requiredOption("--id <number>", "Id of expense", (id) => {
      const parsedId = Number(id);
      if (Number.isNaN(parsedId)) {
        throw new InvalidOptionArgumentError("Id must be a number");
      }

      return parsedId;
    })
    .option("--description [string]", "Description of the expense")
    .option("--amount [number]", "Amount of the expense", (amount) => {
      const parsedAmount = Number(amount);
      if (Number.isNaN(parsedAmount)) {
        throw new InvalidOptionArgumentError("Amount must be a number");
      } else if (parsedAmount <= 0) {
        throw new InvalidOptionArgumentError("Amount must be greater than 0");
      }
      return parsedAmount;
    })
    .action(async (props) => {
      const result = await updateService(props);

      if ("error" in result) {
        console.log(`Error:: ${result.error}`);
        return;
      }

      console.log(`Success: ${result.message}`);
    });

  return command;
}

function listCommand() {
  const command = new Command("list");
  command.action(listService);
  return command;
}

function deleteCommand() {
  const command = new Command("delete");
  command
    .command("delete")
    .requiredOption("--id <number>", "Delete expense by an id", (id) => {
      const parsedId = Number(id);
      if (Number.isNaN(parsedId)) {
        throw new InvalidOptionArgumentError("Id must be a number");
      }
      return parsedId;
    })
    .action(async (params) => {
      const result = await deleteService(params);

      if ("error" in result) {
        console.log(`Error:: ${result.error}`);
        return;
      }

      console.log(`Success: ${result.message}`);
    });

  return command;
}

function summaryCommand() {
  const command = new Command("summary");

  command
    .description("Get summary of expenses")
    .addOption(
      new Option("--month <number>", "Summary for month").argParser((month) => {
        const parsedMonth = parseNumber(month);

        const notValidMonth = Number.isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12;

        if (notValidMonth) {
          throw new InvalidOptionArgumentError("Invalid month. Allowed 1-12 numbers only");
        }

        return parsedMonth;
      }),
    )
    .action(async (props) => {
      const result = await summaryService(props);

      if ("error" in result) {
        console.log(`Error:: ${result.error}`);
        return;
      }

      if (result.data.month) {
        const month = result.data.month;
        console.log(`Total expenses for ${MONTHS[month as keyof typeof MONTHS]}: `, result.data.total);
      } else {
        console.log(`Total expenses: `, result.data.total);
      }
    });

  return command;
}

//************************************************
//********************* Main *********************
//************************************************

async function main() {
  const dbExists = existsSync(DB_PATH);
  if (!dbExists) {
    try {
      console.log("Info:: Database does not exists. Creating new one. Wait...");
      await createDatabase(DB_PATH);
      console.log("Success:: Database created successfully.");
    } catch (error) {
      console.log("Error:: Error while created database");
      return;
    }
  }

  const program = new Command();
  program.name("expense-tracker").description("CLI tool for managing expenses").version("1.0.0");

  // add command
  const _addCommand = addCommand();

  // update command
  const _updateCommand = updateCommand();

  // delete command
  const _deleteCommand = deleteCommand();

  // list command
  const _listCommand = listCommand();

  // summary command
  const _summaryCommand = summaryCommand();

  program
    .addCommand(_addCommand)
    .addCommand(_updateCommand)
    .addCommand(_deleteCommand)
    .addCommand(_listCommand, { isDefault: true })
    .addCommand(_summaryCommand);
  await program.parseAsync();
}

main();
