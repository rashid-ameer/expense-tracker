# Expense Tracker

This project is part of the backend series from [roadmap.sh](https://roadmap.sh/projects/expense-tracker).

## Description

It is a Node.js CLI application that lets users add, update, delete, list, and summarize expenses, and export them to a CSV file.

## How to run it locally

- Download the project.
- Open terminal in project directory and run `npm install`.

## How to use this application

### Add Expense

```bash
# npm run dev add --description "description of expense" --amount amount
npm run dev add --description "Groceries" --amount 50
```

### Update Expense

```bash
# npm run dev update --id expense_id --description "updated description" --amount updated_amount
npm run dev update --id 1 --description "Groceries and household items" --amount 65
```

### Delete Expense

```bash
# npm run dev delete --id expense_id
npm run dev delete --id 1
```

### List All Expenses

```bash
npm run dev list
```

### Summary of Expenses

```bash
# Total of all expenses
npm run dev summary

# Total expenses for a specific month (1-12)
npm run dev summary --month 8
```

### Generate CSV

```bash
# Generates expense.csv by default
npm run dev generate-csv

# Generates a CSV file with a custom name
npm run dev generate-csv --name my-expenses
```