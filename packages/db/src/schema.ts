import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    boolean,
    integer,
    decimal,
    pgEnum,
    jsonb,
    bigint,
    index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =============================================================================
// ENUMS
// =============================================================================

export const tierEnum = pgEnum("tier", ["standard", "pro", "family"]);
export const txTypeEnum = pgEnum("tx_type", ["income", "expense", "transfer", "adjustment"]);
export const registrationStatusEnum = pgEnum("registration_status", ["pending", "approved", "rejected"]);

// =============================================================================
// USERS
// =============================================================================

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    tier: tierEnum("tier").notNull().default("standard"),
    isActive: boolean("is_active").notNull().default(true),
    incomeDate: integer("income_date").default(1),
    isIncomeUncertain: boolean("is_income_uncertain").default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const telegramAccounts = pgTable("telegram_accounts", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
    username: varchar("username", { length: 255 }),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    languageCode: varchar("language_code", { length: 10 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    telegramIdIdx: index("telegram_accounts_telegram_id_idx").on(table.telegramId),
}));

// =============================================================================
// GROUPS (Family Tier)
// =============================================================================

export const groups = pgTable("groups", {
    id: uuid("id").primaryKey().defaultRandom(),
    telegramGroupId: bigint("telegram_group_id", { mode: "number" }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const familyMembers = pgTable("family_members", {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull().default("member"), // owner, admin, member
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

// =============================================================================
// DATE PERIODS
// =============================================================================

export const datePeriods = pgTable("date_periods", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(), // e.g., "Januari 2025"
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    userPeriodIdx: index("date_periods_user_id_idx").on(table.userId),
    groupPeriodIdx: index("date_periods_group_id_idx").on(table.groupId),
}));

// =============================================================================
// BUDGETS
// =============================================================================

export const budgets = pgTable("budgets", {
    id: uuid("id").primaryKey().defaultRandom(),
    periodId: uuid("period_id").notNull().references(() => datePeriods.id, { onDelete: "cascade" }),
    estimatedIncome: decimal("estimated_income", { precision: 15, scale: 2 }).notNull(),
    needsAmount: decimal("needs_amount", { precision: 15, scale: 2 }).notNull(),
    wantsAmount: decimal("wants_amount", { precision: 15, scale: 2 }).notNull(),
    savingsAmount: decimal("savings_amount", { precision: 15, scale: 2 }).notNull(),
    needsPercentage: integer("needs_percentage").notNull().default(50),
    wantsPercentage: integer("wants_percentage").notNull().default(30),
    savingsPercentage: integer("savings_percentage").notNull().default(20),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =============================================================================
// CATEGORIES
// =============================================================================

export const categories = pgTable("categories", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    icon: varchar("icon", { length: 50 }),
    bucket: varchar("bucket", { length: 50 }), // free text: needs, wants, savings, or custom
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================================================
// TRANSACTIONS
// =============================================================================

export const transactions = pgTable("transactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    periodId: uuid("period_id").notNull().references(() => datePeriods.id),
    categoryId: uuid("category_id").references(() => categories.id),
    groupId: uuid("group_id").references(() => groups.id),
    type: txTypeEnum("type").notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    description: text("description"),
    bucket: varchar("bucket", { length: 50 }), // free text for bucket assignment
    rawMessage: text("raw_message"), // original message from user
    aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }), // 0.00 - 1.00
    fileId: uuid("file_id").references(() => files.id),
    voiceTranscriptId: uuid("voice_transcript_id").references(() => voiceTranscripts.id),
    transactionDate: timestamp("transaction_date").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    userPeriodIdx: index("transactions_user_period_idx").on(table.userId, table.periodId),
    groupPeriodIdx: index("transactions_group_period_idx").on(table.groupId, table.periodId),
}));

// =============================================================================
// FILES (Invoice uploads)
// =============================================================================

export const files = pgTable("files", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    periodId: uuid("period_id").references(() => datePeriods.id),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileType: varchar("file_type", { length: 50 }).notNull(),
    fileSize: integer("file_size").notNull(),
    telegramFileId: varchar("telegram_file_id", { length: 255 }),
    googleDriveId: varchar("google_drive_id", { length: 255 }),
    googleDriveUrl: text("google_drive_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================================================
// VOICE TRANSCRIPTS
// =============================================================================

export const voiceTranscripts = pgTable("voice_transcripts", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    telegramFileId: varchar("telegram_file_id", { length: 255 }).notNull(),
    duration: integer("duration"), // in seconds
    transcript: text("transcript"),
    parsedData: jsonb("parsed_data"), // parsed transaction data from transcript
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================================================
// AI USAGE TRACKING
// =============================================================================

export const aiUsage = pgTable("ai_usage", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    model: varchar("model", { length: 100 }).notNull(),
    operation: varchar("operation", { length: 50 }).notNull(), // parse, classify, summarize
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    cost: decimal("cost", { precision: 10, scale: 6 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================================================
// PENDING REGISTRATIONS
// =============================================================================

export const pendingRegistrations = pgTable("pending_registrations", {
    id: uuid("id").primaryKey().defaultRandom(),
    telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
    username: varchar("username", { length: 255 }),
    firstName: varchar("first_name", { length: 255 }),
    requestedTier: tierEnum("requested_tier").notNull(),
    status: registrationStatusEnum("status").notNull().default("pending"),
    adminMessageId: integer("admin_message_id"), // to update the message later
    processedAt: timestamp("processed_at"),
    processedBy: bigint("processed_by", { mode: "number" }), // admin telegram id
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================================================
// GOOGLE INTEGRATION
// =============================================================================

export const googleTokens = pgTable("google_tokens", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at"),
    scope: text("scope"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const googleSheets = pgTable("google_sheets", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    periodId: uuid("period_id").notNull().references(() => datePeriods.id),
    spreadsheetId: varchar("spreadsheet_id", { length: 255 }).notNull(),
    spreadsheetUrl: text("spreadsheet_url").notNull(),
    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const googleDriveFolders = pgTable("google_drive_folders", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    periodId: uuid("period_id").notNull().references(() => datePeriods.id),
    folderId: varchar("folder_id", { length: 255 }).notNull(),
    folderUrl: text("folder_url").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================================================
// RELATIONS
// =============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
    telegramAccount: one(telegramAccounts, {
        fields: [users.id],
        references: [telegramAccounts.userId],
    }),
    transactions: many(transactions),
    categories: many(categories),
    files: many(files),
    voiceTranscripts: many(voiceTranscripts),
    aiUsage: many(aiUsage),
    googleToken: one(googleTokens, {
        fields: [users.id],
        references: [googleTokens.userId],
    }),
}));

export const telegramAccountsRelations = relations(telegramAccounts, ({ one }) => ({
    user: one(users, {
        fields: [telegramAccounts.userId],
        references: [users.id],
    }),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
    owner: one(users, {
        fields: [groups.ownerId],
        references: [users.id],
    }),
    members: many(familyMembers),
    periods: many(datePeriods),
    transactions: many(transactions),
}));

export const datePeriodsRelations = relations(datePeriods, ({ one, many }) => ({
    user: one(users, {
        fields: [datePeriods.userId],
        references: [users.id],
    }),
    group: one(groups, {
        fields: [datePeriods.groupId],
        references: [groups.id],
    }),
    budget: one(budgets, {
        fields: [datePeriods.id],
        references: [budgets.periodId],
    }),
    transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
    user: one(users, {
        fields: [transactions.userId],
        references: [users.id],
    }),
    period: one(datePeriods, {
        fields: [transactions.periodId],
        references: [datePeriods.id],
    }),
    category: one(categories, {
        fields: [transactions.categoryId],
        references: [categories.id],
    }),
    file: one(files, {
        fields: [transactions.fileId],
        references: [files.id],
    }),
    voiceTranscript: one(voiceTranscripts, {
        fields: [transactions.voiceTranscriptId],
        references: [voiceTranscripts.id],
    }),
}));
