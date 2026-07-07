import fs from "node:fs";
import promiseFs from "node:fs/promises";
import path from "node:path";
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
function validateFiniteNumber(value: string | boolean | number | null | undefined): { valid: false } | { valid: true; value: number } {
  if (value === null || value === undefined) return { valid: false };
  if (typeof value === "boolean") return { valid: false };
  if (typeof value === "string" && value.trim() === "") return { valid: false };

  const num = Number(value);
  if (!Number.isFinite(num)) return { valid: false };

  return { valid: true, value: num };
}

// query database
async function queryDatabase(path: string) {
  return await promiseFs.readFile(path, { encoding: "utf-8" });
}

// write to a database
async function writeDatabase(path: string, data: string) {
  return await promiseFs.writeFile(path, data);
}

// create a database
async function createDatabase(path: string) {
  return await promiseFs.writeFile(path, "[]");
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

function getTime(
  date: Date,
  hourFormat: Intl.DateTimeFormatOptions["hour"] = "2-digit",
  minuteFormat: Intl.DateTimeFormatOptions["minute"] = "2-digit",
  hour12Format: Intl.DateTimeFormatOptions["hour12"] = true,
) {
  return date.toLocaleTimeString(undefined, { hour: hourFormat, minute: minuteFormat, hour12: hour12Format });
}

//************************************************
//***************** Services *********************
//************************************************
type AddServiceProps = {
  description: string;
  amount: number;
};

async function addService(
  props: AddServiceProps,
): Promise<{ success: true; message: string; data: Expense } | { success: false; error: string }> {
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
    return { success: true, data: newExpense, message: `Expense added successfully (ID: ${newExpense.id})` };
  } catch (error) {
    return { success: false, error: `Failed to create expense. Please try again.` };
  }
}

type UpdateServiceProps = {
  id: number;
  description?: string;
  amount?: number;
};

async function updateService(
  props: UpdateServiceProps,
): Promise<{ success: true; message: string; data: Expense } | { success: false; error: string }> {
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

    const newData = data.with(expenseIndex, updatedExpense);

    await writeDatabase(DB_PATH, JSON.stringify(newData));
    return { success: true, message: `Expense with ID = ${props.id} updated successfully.`, data: updatedExpense };
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
    const startTime = getTime(cat);
    const endTime = getTime(uat);

    console.log("Id: ", expense.id);
    console.log("Description: ", expense.description);
    console.log("Amount: ", expense.amount);
    console.log("Created At: ", `${createdAt} at ${startTime}`);
    console.log("Updated At: ", `${updatedAt} at ${endTime}`);
    console.log("\n**********************************\n");
  }
}

type DeleteServiceParams = {
  id: number;
};
async function deleteService(params: DeleteServiceParams): Promise<{ success: true; message: string } | { success: false; error: string }> {
  try {
    const json = await queryDatabase(DB_PATH);
    const data = JSON.parse(json) as Expense[];
    const newData = data.filter((f) => f.id !== params.id);

    if (newData.length === data.length) {
      // expense not present so no need to re-write same data
      return { success: true, message: `Expense with ID = ${params.id} deleted successfully.` };
    }

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

    if (params.month) {
      total = data.reduce((acc, expense) => {
        const month = Number(getMonth(new Date(expense.createdAt), "numeric"));
        if (month === params.month) return acc + expense.amount;
        return acc;
      }, 0);
    } else {
      total = data.reduce((acc, expense) => {
        return acc + expense.amount;
      }, 0);
    }

    return { success: true, data: { total, month: params.month } };
  } catch (error) {
    return { success: false, error: "Failed to get summary. Please try again." };
  }
}

type CsvServiceParams = {
  name?: string;
};
async function csvService(params: CsvServiceParams): Promise<{ message: string; success: true } | { success: false; error: string }> {
  try {
    const json = await queryDatabase(DB_PATH);
    const data = JSON.parse(json) as Expense[];
    const fileName = params.name ? params.name + ".csv" : "expense.csv";
    const csvFilePath = path.join(import.meta.dirname, fileName);

    // convert into csv format form
    let csvStr = "id,description,amount,createdAt,updatedAt\n";
    data.forEach((expense) => {
      csvStr += [expense.id, expense.description, expense.amount, expense.createdAt, expense.updatedAt].join(",") + "\n";
    });

    fs.writeFile(csvFilePath, csvStr, (err) => {
      if (err) {
        throw err;
      }
    });

    return { success: true, message: "CSV file generated successfully." };
  } catch (error) {
    return { success: false, error: "Failed to generate a CSV file. Please try again." };
  }
}

//************************************************
//***************** Controllers ******************
//************************************************

// add command
function addCommand() {
  const command = new Command("add");
  command
    .description("Add expense")
    .requiredOption("--description <string>", "Description of the expense")
    .requiredOption("--amount <number>", "Amount of the expense", (amount) => {
      const num = validateFiniteNumber(amount);
      const isValidAmount = num.valid && num.value > 0;
      if (isValidAmount) {
        return num.value;
      }
      throw new InvalidOptionArgumentError("Amount must be a valid finite number and greater than 0");
    })
    .action(async (props) => {
      const result = await addService(props);

      if ("error" in result) {
        console.log(`Error:: ${result.error}`);
        return;
      }

      console.log(`Success:: ${result.message}`);
    });

  return command;
}

// update command
function updateCommand() {
  const command = new Command("update");

  command
    .description("Update expense by id")
    .requiredOption("--id <number>", "Id of expense", (id) => {
      const num = validateFiniteNumber(id);
      if (!num.valid) {
        throw new InvalidOptionArgumentError("Id must be a valid finite number");
      }

      return num.value;
    })
    .option("--description <string>", "Description of the expense")
    .option("--amount <number>", "Amount of the expense", (amount) => {
      const num = validateFiniteNumber(amount);
      const isValidAmount = num.valid && num.value > 0;
      if (isValidAmount) {
        return num.value;
      }
      throw new InvalidOptionArgumentError("Amount must be a valid finite number and greater than 0");
    })
    .action(async (props) => {
      const result = await updateService(props);

      if ("error" in result) {
        console.log(`Error:: ${result.error}`);
        return;
      }

      console.log(`Success:: ${result.message}`);
    });

  return command;
}

// list
function listCommand() {
  const command = new Command("list");
  command.description("List all expenses").action(listService);
  return command;
}

// delete
function deleteCommand() {
  const command = new Command("delete");
  command
    .description("Delete expense by id")
    .requiredOption("--id <number>", "Id of an expense", (id) => {
      const num = validateFiniteNumber(id);
      if (num.valid) {
        return num.value;
      }

      throw new InvalidOptionArgumentError("Id must be a valid finite number");
    })
    .action(async (params) => {
      const result = await deleteService(params);

      if ("error" in result) {
        console.log(`Error:: ${result.error}`);
        return;
      }

      console.log(`Success:: Expense with ID = ${params.id} deleted successfully.`);
    });

  return command;
}

// summary
function summaryCommand() {
  const command = new Command("summary");

  command
    .description("Get summary of expenses")
    .addOption(
      new Option("--month <number>", "Summary for month").argParser((month) => {
        const num = validateFiniteNumber(month);
        const isValidMonth = num.valid && num.value >= 1 && num.value <= 12;
        if (isValidMonth) {
          return num.value;
        }
        throw new InvalidOptionArgumentError("Invalid month. Allowed 1-12 only");
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
        console.log(`Total expenses for ${MONTHS[month as keyof typeof MONTHS]}:: `, result.data.total);
      } else {
        console.log(`Total expenses:: `, result.data.total);
      }
    });

  return command;
}

// csv
function csvCommand() {
  const command = new Command("generate-csv");
  command
    .description("Generate csv file")
    .option("--name <string>", "CSV file name")
    .action(async (opts) => {
      const result = await csvService(opts);
      if ("error" in result) {
        console.log(`Error:: ${result.error}`);
        return;
      }

      console.log(`Success: ${result.message}`);
    });
  return command;
}

//************************************************
//********************* Main *********************
//************************************************

async function main() {
  const dbExists = fs.existsSync(DB_PATH);
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

  // csv command
  const _csvCommand = csvCommand();

  program
    .addCommand(_addCommand)
    .addCommand(_updateCommand)
    .addCommand(_deleteCommand)
    .addCommand(_listCommand, { isDefault: true })
    .addCommand(_summaryCommand)
    .addCommand(_csvCommand);

  await program.parseAsync();
}

main();
