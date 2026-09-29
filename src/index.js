#!/usr/bin/env node

/**
 * @fileoverview Zefix MCP Server - Main entry point.
 * 
 * Model Context Protocol (MCP) server providing tools for querying
 * Swiss business registry data via Zefix and UID Webservice APIs.
 * 
 * **Features:**
 * - Company search by name, canton, legal form
 * - UID and VAT number validation
 * - Due diligence report generation
 * - SOGC (Swiss Official Gazette of Commerce) publications
 * - Advanced company search with UID Webservice
 * 
 * **Communication:**
 * - Uses stdio transport for MCP communication
 * - Integrates with Claude Desktop and other MCP clients
 * 
 * **Tool Categories:**
 * - Search: Company search and advanced filtering
 * - Validation: UID and VAT number validation
 * - SOGC: Daily registrations and company publications
 * - Due Diligence: Comprehensive company reports
 * - UID-Only: Direct UID Webservice queries (no auth required)
 * 
 * @module index
 * @see {@link https://modelcontextprotocol.io/|Model Context Protocol}
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from './utils/logger.js';
import { shapeToJsonSchema } from './utils/json-schema.js';
import { registerSearchTools } from './tools/company-search.js';
import { registerValidationTools } from './tools/validation.js';
import { registerSogcTools } from './tools/sogc.js';
import { registerDueDiligenceTools } from './tools/due-diligence.js';
import { registerUidOnlyTools } from './tools/uid-only.js';

/**
 * MCP server instance.
 * 
 * Configured with server metadata and capabilities.
 * Supports tool execution via the MCP protocol.
 * 
 * @type {Server}
 */
const server = new Server(
  {
    name: 'zefix-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Registry of all available tools.
 * 
 * Maps tool names to their metadata and handler functions.
 * Populated during tool registration phase.
 * 
 * @type {Map<string, Object>}
 */
const tools = new Map();

/**
 * Helper method to register a tool with the MCP server.
 * 
 * Converts Zod schemas to JSON Schema format for MCP compatibility.
 * Automatically determines required vs optional parameters.
 * 
 * @param {string} name - Unique tool name
 * @param {string} description - Tool description for LLM
 * @param {Object} inputSchema - Zod schema object defining parameters
 * @param {Function} handler - Async function to execute tool logic
 * 
 * @returns {void}
 * 
 * @example
 * server.tool(
 *   'search_companies',
 *   'Search for Swiss companies',
 *   {
 *     name: z.string().describe('Company name to search'),
 *     canton: z.string().optional().describe('Canton code')
 *   },
 *   async (args) => {
 *     // Tool implementation
 *     return { content: [...] };
 *   }
 * );
 */
server.tool = function(name, description, inputSchema, handler) {
  tools.set(name, {
    name,
    description,
    inputSchema: shapeToJsonSchema(inputSchema),
    handler,
  });
};

/**
 * Register all tool categories with the server.
 * 
 * Each registration function adds its tools to the server's tool registry.
 * Tools are organized by functional category for maintainability.
 */
registerSearchTools(server);
registerValidationTools(server);
registerSogcTools(server);
registerDueDiligenceTools(server);
registerUidOnlyTools(server);

logger.info({ toolCount: tools.size }, 'Registered tools');

/**
 * Handle MCP list_tools request.
 * 
 * Returns metadata for all registered tools, including:
 * - Tool name
 * - Description
 * - Input schema (JSON Schema format)
 * 
 * @param {Object} request - MCP list tools request
 * @returns {Promise<Object>} List of available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.debug('Listing tools');
  
  return {
    tools: Array.from(tools.values()).map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  };
});

/**
 * Handle MCP call_tool request.
 * 
 * Executes the requested tool with provided arguments.
 * Handles errors gracefully and returns structured responses.
 * 
 * **Error Handling:**
 * - Unknown tools return error message
 * - Tool execution errors are caught and formatted
 * - All errors are logged with context
 * 
 * @param {Object} request - MCP call tool request
 * @param {Object} request.params - Request parameters
 * @param {string} request.params.name - Tool name to execute
 * @param {Object} request.params.arguments - Tool arguments
 * 
 * @returns {Promise<Object>} Tool execution result or error
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  logger.info({ toolName: name, args }, 'Tool called');

  const tool = tools.get(name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await tool.handler(args || {});
    logger.info({ toolName: name }, 'Tool executed successfully');
    return result;
  } catch (error) {
    logger.error({ toolName: name, error: error.message }, 'Tool execution failed');
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            tool: name,
            arguments: args,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start the MCP server.
 * 
 * Initializes stdio transport and connects the server.
 * Logs startup information and handles fatal errors.
 * 
 * **Process:**
 * 1. Create stdio transport for MCP communication
 * 2. Connect server to transport
 * 3. Log successful startup
 * 4. Handle any startup errors
 * 
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If server fails to start
 */
async function main() {
  logger.info('Starting Zefix MCP Server...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  logger.info('Zefix MCP Server running on stdio');
}

main().catch((error) => {
  logger.error({ error: error.message }, 'Server failed to start');
  process.exit(1);
});
