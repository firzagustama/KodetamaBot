import ExcelJS from "exceljs";
import { Period } from "../types.js";
import { TransactionWithCategory } from "../domain.js";

export class ExcelService {
    /**
     * Generate a financial report Excel workbook
     */
    async generateFinancialReport(period: Period, transactions: TransactionWithCategory[]): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Kodetama Bot";
        workbook.lastModifiedBy = "Kodetama Bot";
        workbook.created = new Date();
        workbook.modified = new Date();

        // 1. Budget and Bucket Sheet
        const budgetSheet = workbook.addWorksheet("Budget and Bucket");

        // Header for Budget
        budgetSheet.addRow(["Budget Overview", period.name]);
        budgetSheet.addRow(["Estimated Income", parseFloat(period.budget?.estimatedIncome || "0")]);
        budgetSheet.addRow([]);

        // Header for Buckets
        budgetSheet.addRow(["Bucket Name", "Category", "Allocated Amount", "Description"]);

        // Style header
        const bucketHeaderRow = budgetSheet.getRow(4);
        bucketHeaderRow.font = { bold: true };
        bucketHeaderRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD3D3D3" }
        };

        if (period.budget?.buckets) {
            for (const bucket of period.budget.buckets) {
                budgetSheet.addRow([
                    bucket.name,
                    bucket.category || "N/A",
                    parseFloat(bucket.amount),
                    bucket.description || ""
                ]);
            }
        }

        // Auto-fit columns for budget sheet
        budgetSheet.columns.forEach(column => {
            column.width = 20;
        });

        // 2. Transactions Sheet
        const txSheet = workbook.addWorksheet("Transactions");

        // Header
        txSheet.addRow(["Date", "Type", "Amount", "Category", "Bucket", "Description"]);
        const txHeaderRow = txSheet.getRow(1);
        txHeaderRow.font = { bold: true };
        txHeaderRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD3D3D3" }
        };

        for (const tx of transactions) {
            txSheet.addRow([
                tx.transactionDate,
                tx.type,
                parseFloat(tx.amount),
                tx.category?.name || "N/A", // We might want to resolve category name later if needed
                tx.bucket || "N/A",
                tx.description || ""
            ]);
        }

        // Auto-fit columns for transactions sheet
        txSheet.columns.forEach(column => {
            column.width = 20;
        });

        // Generate Buffer
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
}
