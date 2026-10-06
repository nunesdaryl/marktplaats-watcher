// Shared user-facing catalog. Python MCP reads the same JSON file.
import catalog from "./templates.json";

export const TEMPLATES_VERSION = catalog.version;
export const TEMPLATES = catalog.templates;
