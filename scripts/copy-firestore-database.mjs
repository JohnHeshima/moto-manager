#!/usr/bin/env node

import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const FIRESTORE_API_BASE = "https://firestore.googleapis.com/v1";
const DEFAULT_SOURCE_DB = "driver-payment-manager";
const DEFAULT_TARGET_DB = "driver-payment-manager-dev";
const DEFAULT_PAGE_SIZE = 200;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function printUsage() {
    console.log(`
Usage:
  npm run firestore:copy-db -- --source-db=<sourceDatabaseId> --target-db=<targetDatabaseId> [--project-id=<projectId>] [--gcloud-account=<email>] [--page-size=<number>] [--dry-run]

Examples:
  npm run firestore:copy-db -- --source-db=driver-payment-manager --target-db=driver-payment-manager-dev
  npm run firestore:copy-db -- --gcloud-account=johnheshima6@gmail.com
  npm run firestore:copy-db -- --dry-run
`.trim());
}

function parseArgs(argv) {
    const options = {
        sourceDb: DEFAULT_SOURCE_DB,
        targetDb: DEFAULT_TARGET_DB,
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "",
        gcloudAccount: process.env.GCLOUD_ACCOUNT || "",
        pageSize: DEFAULT_PAGE_SIZE,
        dryRun: false,
    };

    for (const arg of argv) {
        if (arg === "--help" || arg === "-h") {
            printUsage();
            process.exit(0);
        }

        if (arg === "--dry-run") {
            options.dryRun = true;
            continue;
        }

        const [key, value] = arg.split("=");

        if (!value) {
            throw new Error(`Argument invalide: ${arg}`);
        }

        if (key === "--source-db") {
            options.sourceDb = value;
            continue;
        }

        if (key === "--target-db") {
            options.targetDb = value;
            continue;
        }

        if (key === "--project-id") {
            options.projectId = value;
            continue;
        }

        if (key === "--gcloud-account") {
            options.gcloudAccount = value;
            continue;
        }

        if (key === "--page-size") {
            const pageSize = Number(value);

            if (!Number.isInteger(pageSize) || pageSize <= 0 || pageSize > 500) {
                throw new Error("--page-size doit être un entier entre 1 et 500");
            }

            options.pageSize = pageSize;
            continue;
        }

        throw new Error(`Argument inconnu: ${arg}`);
    }

    if (options.sourceDb === options.targetDb) {
        throw new Error("La base source et la base cible doivent être différentes");
    }

    return options;
}

async function resolveProjectId(explicitProjectId) {
    if (explicitProjectId) {
        return explicitProjectId;
    }

    const firebasercPath = path.join(projectRoot, ".firebaserc");

    try {
        const raw = await readFile(firebasercPath, "utf8");
        const parsed = JSON.parse(raw);
        const projectId = parsed?.projects?.default;

        if (projectId) {
            return projectId;
        }
    } catch (error) {
        if (error?.code !== "ENOENT") {
            throw error;
        }
    }

    throw new Error("Impossible de déterminer le projectId. Passe --project-id=<id>.");
}

function databaseName(projectId, databaseId) {
    return `projects/${projectId}/databases/${databaseId}`;
}

function documentsRoot(projectId, databaseId) {
    return `${databaseName(projectId, databaseId)}/documents`;
}

function encodeResourcePath(resourcePath) {
    return resourcePath
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

function relativeDocumentPath(documentName, sourceDocumentsRootPath) {
    const prefix = `${sourceDocumentsRootPath}/`;

    if (!documentName.startsWith(prefix)) {
        throw new Error(`Chemin de document inattendu: ${documentName}`);
    }

    return documentName.slice(prefix.length);
}

function transformValue(value, sourceDocumentsRootPath, targetDocumentsRootPath) {
    if (value === null || typeof value !== "object") {
        return value;
    }

    if ("referenceValue" in value && typeof value.referenceValue === "string") {
        if (value.referenceValue === sourceDocumentsRootPath) {
            return {
                ...value,
                referenceValue: targetDocumentsRootPath,
            };
        }

        if (value.referenceValue.startsWith(`${sourceDocumentsRootPath}/`)) {
            return {
                ...value,
                referenceValue: `${targetDocumentsRootPath}/${value.referenceValue.slice(sourceDocumentsRootPath.length + 1)}`,
            };
        }

        return value;
    }

    if ("mapValue" in value) {
        return {
            ...value,
            mapValue: {
                ...value.mapValue,
                fields: transformFields(value.mapValue?.fields || {}, sourceDocumentsRootPath, targetDocumentsRootPath),
            },
        };
    }

    if ("arrayValue" in value) {
        return {
            ...value,
            arrayValue: {
                ...value.arrayValue,
                values: (value.arrayValue?.values || []).map((item) =>
                    transformValue(item, sourceDocumentsRootPath, targetDocumentsRootPath)
                ),
            },
        };
    }

    return value;
}

function transformFields(fields, sourceDocumentsRootPath, targetDocumentsRootPath) {
    return Object.fromEntries(
        Object.entries(fields).map(([fieldName, fieldValue]) => [
            fieldName,
            transformValue(fieldValue, sourceDocumentsRootPath, targetDocumentsRootPath),
        ])
    );
}

async function getAccessToken(gcloudAccount) {
    const gcloudConfigDir = await prepareGcloudConfigDir();
    const commands = gcloudAccount
        ? [["gcloud", ["auth", "print-access-token", `--account=${gcloudAccount}`]]]
        : [
            ["gcloud", ["auth", "application-default", "print-access-token"]],
            ["gcloud", ["auth", "print-access-token"]],
        ];

    const env = {
        ...process.env,
        CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
        ...(gcloudConfigDir ? { CLOUDSDK_CONFIG: gcloudConfigDir } : {}),
    };

    const errors = [];

    for (const [command, args] of commands) {
        try {
            const { stdout } = await execFileAsync(command, args, { env });
            const token = stdout.trim();

            if (token) {
                return token;
            }
        } catch (error) {
            errors.push(`${command} ${args.join(" ")}: ${error.message}`);
        }
    }

    throw new Error(`Impossible d'obtenir un access token gcloud.\n${errors.join("\n")}`);
}

async function prepareGcloudConfigDir() {
    const homeDir = process.env.HOME;

    if (!homeDir) {
        return "";
    }

    const sourceDir = path.join(homeDir, ".config", "gcloud");
    const targetDir = await mkdtemp(path.join(os.tmpdir(), "gcloud-config-"));

    try {
        await cp(sourceDir, targetDir, { recursive: true });
        return targetDir;
    } catch (error) {
        if (error?.code === "ENOENT") {
            return "";
        }

        throw error;
    }
}

async function apiRequest(accessToken, url, init = {}) {
    let response;

    try {
        response = await fetch(url, {
            ...init,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                ...(init.headers || {}),
            },
        });
    } catch (error) {
        throw new Error(`Network error while calling Firestore API: ${error.message}`);
    }

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Firestore API ${response.status} ${response.statusText}: ${body}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

async function listDatabases(projectId, accessToken) {
    const url = `${FIRESTORE_API_BASE}/projects/${encodeURIComponent(projectId)}/databases`;
    const response = await apiRequest(accessToken, url);
    return response.databases || [];
}

async function listCollectionIds(parent, accessToken, pageSize) {
    const collectionIds = [];
    let pageToken = "";

    do {
        const url = `${FIRESTORE_API_BASE}/${encodeResourcePath(parent)}:listCollectionIds`;
        const response = await apiRequest(accessToken, url, {
            method: "POST",
            body: JSON.stringify({
                pageSize,
                ...(pageToken ? { pageToken } : {}),
            }),
        });

        collectionIds.push(...(response.collectionIds || []));
        pageToken = response.nextPageToken || "";
    } while (pageToken);

    return collectionIds;
}

async function listDocumentsPage(parent, collectionId, accessToken, pageSize, pageToken) {
    const params = new URLSearchParams({
        pageSize: String(pageSize),
    });

    if (pageToken) {
        params.set("pageToken", pageToken);
    }

    const url = `${FIRESTORE_API_BASE}/${encodeResourcePath(parent)}/${encodeURIComponent(collectionId)}?${params.toString()}`;
    const response = await apiRequest(accessToken, url);

    return {
        documents: response.documents || [],
        nextPageToken: response.nextPageToken || "",
    };
}

async function commitWrites(projectId, targetDb, accessToken, writes) {
    if (writes.length === 0) {
        return;
    }

    const url = `${FIRESTORE_API_BASE}/${encodeResourcePath(databaseName(projectId, targetDb))}/documents:commit`;
    await apiRequest(accessToken, url, {
        method: "POST",
        body: JSON.stringify({ writes }),
    });
}

async function copySubtree({
    sourceParent,
    accessToken,
    projectId,
    targetDb,
    sourceDocumentsRootPath,
    targetDocumentsRootPath,
    pageSize,
    dryRun,
    stats,
}) {
    const collectionIds = await listCollectionIds(sourceParent, accessToken, pageSize);

    for (const collectionId of collectionIds) {
        const relativeParentPath =
            sourceParent === sourceDocumentsRootPath
                ? ""
                : relativeDocumentPath(sourceParent, sourceDocumentsRootPath);
        const collectionPath = relativeParentPath ? `${relativeParentPath}/${collectionId}` : collectionId;

        stats.collectionPaths.add(collectionPath);

        let pageToken = "";

        do {
            const { documents, nextPageToken } = await listDocumentsPage(
                sourceParent,
                collectionId,
                accessToken,
                pageSize,
                pageToken
            );

            const writes = [];
            const nestedParents = [];

            for (const document of documents) {
                const relativePath = relativeDocumentPath(document.name, sourceDocumentsRootPath);
                const targetDocumentName = `${targetDocumentsRootPath}/${relativePath}`;
                const fields = transformFields(
                    document.fields || {},
                    sourceDocumentsRootPath,
                    targetDocumentsRootPath
                );

                writes.push({
                    update: {
                        name: targetDocumentName,
                        fields,
                    },
                });

                nestedParents.push({
                    sourceParent: document.name,
                });

                stats.documentsCopied += 1;
            }

            if (!dryRun) {
                await commitWrites(projectId, targetDb, accessToken, writes);
            }

            for (const nestedParent of nestedParents) {
                await copySubtree({
                    sourceParent: nestedParent.sourceParent,
                    accessToken,
                    projectId,
                    targetDb,
                    sourceDocumentsRootPath,
                    targetDocumentsRootPath,
                    pageSize,
                    dryRun,
                    stats,
                });
            }

            pageToken = nextPageToken;
        } while (pageToken);
    }
}

async function ensureDatabasesExist(projectId, sourceDb, targetDb, accessToken) {
    const databases = await listDatabases(projectId, accessToken);
    const existingIds = new Set(databases.map((database) => database.name.split("/").pop()));

    if (!existingIds.has(sourceDb)) {
        throw new Error(`Base source introuvable: ${sourceDb}`);
    }

    if (!existingIds.has(targetDb)) {
        throw new Error(`Base cible introuvable: ${targetDb}`);
    }
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const projectId = await resolveProjectId(options.projectId);
    const accessToken = await getAccessToken(options.gcloudAccount);

    await ensureDatabasesExist(projectId, options.sourceDb, options.targetDb, accessToken);

    const sourceDocumentsRootPath = documentsRoot(projectId, options.sourceDb);
    const targetDocumentsRootPath = documentsRoot(projectId, options.targetDb);
    const stats = {
        documentsCopied: 0,
        collectionPaths: new Set(),
    };

    console.log(
        [
            "Firestore copy started",
            `projectId=${projectId}`,
            `sourceDb=${options.sourceDb}`,
            `targetDb=${options.targetDb}`,
            `gcloudAccount=${options.gcloudAccount || "auto"}`,
            `pageSize=${options.pageSize}`,
            `dryRun=${options.dryRun}`,
        ].join(" | ")
    );

    const startedAt = Date.now();

    await copySubtree({
        sourceParent: sourceDocumentsRootPath,
        accessToken,
        projectId,
        targetDb: options.targetDb,
        sourceDocumentsRootPath,
        targetDocumentsRootPath,
        pageSize: options.pageSize,
        dryRun: options.dryRun,
        stats,
    });

    const durationMs = Date.now() - startedAt;

    console.log(
        JSON.stringify(
            {
                projectId,
                sourceDb: options.sourceDb,
                targetDb: options.targetDb,
                dryRun: options.dryRun,
                documentsCopied: stats.documentsCopied,
                collectionsTraversed: stats.collectionPaths.size,
                durationMs,
            },
            null,
            2
        )
    );
}

main().catch((error) => {
    if (error instanceof Error) {
        console.error(error.stack || error.message);
    } else {
        console.error(error);
    }
    process.exit(1);
});
