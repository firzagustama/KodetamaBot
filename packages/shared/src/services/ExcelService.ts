import ExcelJS from "exceljs";
import { Period } from "../types.js";
import { TransactionWithCategory } from "../domain.js";

export class ExcelService {
    /**
     * Generate a financial report Excel workbook
     */
    async generateFinancialReport(period: Period, transactions: TransactionWithCategory[]): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "KodetamaBot";
        workbook.lastModifiedBy = "KodetamaBot";
        workbook.created = new Date();
        workbook.modified = new Date();

        // 1. Summary & Budget Sheet
        const summarySheet = workbook.addWorksheet("Summary");

        // Calculate Summary Data
        const totalIncome = transactions
            .filter(t => t.type === "income")
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const totalExpense = transactions
            .filter(t => t.type === "expense")
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const balance = totalIncome - totalExpense;

        // Group expenses by bucket for summary
        const spendingByBucket = transactions
            .filter(t => t.type === "expense")
            .reduce((acc, t) => {
                const bucket = t.bucket || "Lainnya";
                acc[bucket] = (acc[bucket] || 0) + parseFloat(t.amount);
                return acc;
            }, {} as Record<string, number>);

        // Brand Colors
        const primaryColor = "FF2C3E50"; // Dark Blue
        const secondaryColor = "FF18BC9C"; // Teal
        const headerFont = { bold: true, color: { argb: "FFFFFFFF" } };

        // Header for Summary
        summarySheet.addRow(["FINANCIAL SUMMARY", period.name]);
        const mainHeader = summarySheet.getRow(1);
        mainHeader.font = { bold: true, size: 16, color: { argb: primaryColor } };

        summarySheet.addRow(["Total Income", totalIncome]);
        summarySheet.addRow(["Total Expense", totalExpense]);
        summarySheet.addRow(["Balance", balance]);

        // Style Summary Rows
        [2, 3, 4].forEach(rowNum => {
            const row = summarySheet.getRow(rowNum);
            row.getCell(1).font = { bold: true };
            if (rowNum === 4) {
                row.getCell(2).font = { bold: true, color: { argb: balance >= 0 ? "FF27AE60" : "FFE74C3C" } };
            }
        });
        summarySheet.addRow([]);

        // Header for Buckets (Budget vs Actual)
        const bucketHeader = ["Bucket Name", "Category", "Budgeted", "Actual Spent", "Remaining", "% Used"];
        summarySheet.addRow(bucketHeader);

        // Style Bucket Header
        const bucketHeaderRow = summarySheet.getRow(7);
        bucketHeaderRow.font = headerFont;
        bucketHeaderRow.eachCell((cell) => {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: secondaryColor }
            };
            cell.alignment = { horizontal: "center" };
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };
        });

        if (period.budget?.buckets) {
            for (const bucket of period.budget.buckets) {
                const spent = spendingByBucket[bucket.name] || 0;
                const budgeted = parseFloat(bucket.amount);
                const remaining = budgeted - spent;
                const percentUsed = budgeted > 0 ? (spent / budgeted) : 0;

                const row = summarySheet.addRow([
                    bucket.name,
                    bucket.category || "N/A",
                    budgeted,
                    spent,
                    remaining,
                    percentUsed
                ]);

                // Style data row
                this.applyRowStyle(row, percentUsed);
            }
        }

        // Add "Lainnya" if there are expenses not in any bucket
        const bucketNames = period.budget?.buckets.map(b => b.name) || [];
        for (const [bucket, spent] of Object.entries(spendingByBucket)) {
            if (!bucketNames.includes(bucket)) {
                const row = summarySheet.addRow([
                    bucket,
                    "N/A",
                    0,
                    spent,
                    -spent,
                    1 // 100% used since no budget
                ]);
                this.applyRowStyle(row, 1);
            }
        }

        // Auto-fit columns for summary sheet
        summarySheet.columns.forEach((column) => {
            column.width = 20;
            // Remove Rupiah formatting as requested
            // if (i >= 2 && i <= 4) {
            //     column.numFmt = "#,##0";
            // } else if (i === 5) {
            //     column.numFmt = "0%";
            // }
        });

        // 2. Transactions Sheet
        const txSheet = workbook.addWorksheet("Transactions");

        // Header
        txSheet.addRow(["Date", "Type", "Amount", "Category", "Bucket", "Description"]);
        const txHeaderRow = txSheet.getRow(1);
        txHeaderRow.font = headerFont;
        txHeaderRow.eachCell((cell) => {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: primaryColor }
            };
            cell.alignment = { horizontal: "center" };
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };
        });

        for (const tx of transactions) {
            const row = txSheet.addRow([
                tx.transactionDate,
                tx.type,
                parseFloat(tx.amount),
                tx.category?.name || "N/A",
                tx.bucket || "N/A",
                tx.description || ""
            ]);

            // Alternating row colors
            if (row.number % 2 === 0) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFF9F9F9" }
                    };
                });
            }

            row.eachCell((cell) => {
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" }
                };
            });
        }

        // Auto-fit columns for transactions sheet
        txSheet.columns.forEach((column, i) => {
            column.width = 20;
            if (i === 0) column.width = 15;
            if (i === 5) column.width = 40;
        });

        // Generate Buffer
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    private applyRowStyle(row: ExcelJS.Row, percentUsed: number) {
        row.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };

            // Conditional formatting for % Used column
            if (colNumber === 6) {
                let color = "FF27AE60"; // Green
                if (percentUsed >= 0.9) color = "FFE74C3C"; // Red
                else if (percentUsed >= 0.75) color = "FFF1C40F"; // Yellow

                cell.font = { bold: true, color: { argb: color } };
            }
        });

        // Alternating row colors
        if (row.number % 2 === 0) {
            row.eachCell((cell) => {
                if (!cell.fill) {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFF9F9F9" }
                    };
                }
            });
        }
    }
}
