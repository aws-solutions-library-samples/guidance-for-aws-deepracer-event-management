/**
 * GraphQL Schema Conformance Tests
 *
 * These tests validate that the TypeScript GraphQL operation strings in
 * mutations.ts, queries.ts, and subscriptions.ts are valid against the
 * actual GraphQL schema (schema.graphql).
 *
 * This catches a class of bug where TypeScript migration introduces
 * placeholder or invented types/fields that don't match the real schema.
 *
 * No network calls, no mocking — pure static validation that runs in
 * milliseconds.
 */

import { readFileSync } from 'fs';
import { buildSchema, parse, validate, type GraphQLSchema } from 'graphql';
import { join } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GRAPHQL_DIR = join(__dirname, '..', 'graphql');

/**
 * AWS AppSync uses custom scalars and directives that aren't part of the
 * standard GraphQL spec. We prepend stub definitions so that `buildSchema`
 * can parse the schema without errors.
 */
const APPSYNC_SCALARS_AND_DIRECTIVES = `
  scalar AWSDate
  scalar AWSDateTime
  scalar AWSTimestamp
  scalar AWSTime
  scalar AWSEmail
  scalar AWSJSON
  scalar AWSURL
  scalar AWSPhone
  scalar AWSIPAddress

  directive @aws_api_key on FIELD_DEFINITION | OBJECT
  directive @aws_cognito_user_pools(cognito_groups: [String!]) on FIELD_DEFINITION | OBJECT
  directive @aws_iam on FIELD_DEFINITION | OBJECT
  directive @aws_oidc on FIELD_DEFINITION | OBJECT
  directive @aws_subscribe(mutations: [String!]!) on FIELD_DEFINITION
  directive @aws_auth(cognito_groups: [String!]!) on FIELD_DEFINITION
  directive @aws_lambda on FIELD_DEFINITION | OBJECT
`;

function loadSchema(): GraphQLSchema {
    const schemaSource = readFileSync(join(GRAPHQL_DIR, 'schema.graphql'), 'utf-8');
    return buildSchema(APPSYNC_SCALARS_AND_DIRECTIVES + '\n' + schemaSource);
}

/**
 * Dynamically import a .ts module and return all string exports
 * (each string is a GraphQL operation).
 */
async function loadOperationStrings(filename: string): Promise<Record<string, string>> {
    // Use dynamic import for ESM compatibility
    const mod = await import(join(GRAPHQL_DIR, filename));
    const ops: Record<string, string> = {};
    for (const [name, value] of Object.entries(mod)) {
        if (typeof value === 'string') {
            ops[name] = value;
        }
    }
    return ops;
}

/**
 * Validate a single GraphQL operation string against the schema.
 * Returns an array of error messages (empty = valid).
 */
function validateOperation(schema: GraphQLSchema, operationSource: string): string[] {
    try {
        const doc = parse(operationSource);
        const errors = validate(schema, doc);
        return errors.map((e) => e.message);
    } catch (e: unknown) {
        // Parse error — the string isn't even valid GraphQL syntax
        return [(e as Error).message];
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GraphQL Schema Conformance — Layer 1', () => {
    let schema: GraphQLSchema;

    beforeAll(() => {
        schema = loadSchema();
    });

    // -----------------------------------------------------------------------
    // Test: Schema itself is parseable
    // -----------------------------------------------------------------------
    it('schema.graphql is a valid, parseable GraphQL schema', () => {
        expect(schema).toBeDefined();
        // Should have Mutation, Query, and Subscription root types
        expect(schema.getMutationType()).toBeDefined();
        expect(schema.getQueryType()).toBeDefined();
        expect(schema.getSubscriptionType()).toBeDefined();
    });

    // -----------------------------------------------------------------------
    // mutations.ts
    // -----------------------------------------------------------------------
    describe('mutations.ts — every exported operation is valid against the schema', () => {
        let mutations: Record<string, string>;

        beforeAll(async () => {
            mutations = await loadOperationStrings('mutations.ts');
        });

        it('exports at least one mutation', () => {
            expect(Object.keys(mutations).length).toBeGreaterThan(0);
        });

        it('every mutation is syntactically valid GraphQL', () => {
            const parseErrors: Record<string, string> = {};
            for (const [name, source] of Object.entries(mutations)) {
                try {
                    parse(source);
                } catch (e: unknown) {
                    parseErrors[name] = (e as Error).message;
                }
            }
            expect(parseErrors).toEqual({});
        });

        it('every mutation validates against schema.graphql (correct types, fields, arguments)', () => {
            const validationFailures: Record<string, string[]> = {};
            for (const [name, source] of Object.entries(mutations)) {
                const errors = validateOperation(schema, source);
                if (errors.length > 0) {
                    validationFailures[name] = errors;
                }
            }
            expect(validationFailures).toEqual({});
        });
    });

    // -----------------------------------------------------------------------
    // queries.ts
    // -----------------------------------------------------------------------
    describe('queries.ts — every exported operation is valid against the schema', () => {
        let queries: Record<string, string>;

        beforeAll(async () => {
            queries = await loadOperationStrings('queries.ts');
        });

        it('exports at least one query', () => {
            expect(Object.keys(queries).length).toBeGreaterThan(0);
        });

        it('every query is syntactically valid GraphQL', () => {
            const parseErrors: Record<string, string> = {};
            for (const [name, source] of Object.entries(queries)) {
                try {
                    parse(source);
                } catch (e: unknown) {
                    parseErrors[name] = (e as Error).message;
                }
            }
            expect(parseErrors).toEqual({});
        });

        it('every query validates against schema.graphql (correct types, fields, arguments)', () => {
            const validationFailures: Record<string, string[]> = {};
            for (const [name, source] of Object.entries(queries)) {
                const errors = validateOperation(schema, source);
                if (errors.length > 0) {
                    validationFailures[name] = errors;
                }
            }
            expect(validationFailures).toEqual({});
        });
    });

    // -----------------------------------------------------------------------
    // subscriptions.ts
    // -----------------------------------------------------------------------
    describe('subscriptions.ts — every exported operation is valid against the schema', () => {
        let subscriptions: Record<string, string>;

        beforeAll(async () => {
            subscriptions = await loadOperationStrings('subscriptions.ts');
        });

        it('exports at least one subscription', () => {
            expect(Object.keys(subscriptions).length).toBeGreaterThan(0);
        });

        it('every subscription is syntactically valid GraphQL', () => {
            const parseErrors: Record<string, string> = {};
            for (const [name, source] of Object.entries(subscriptions)) {
                try {
                    parse(source);
                } catch (e: unknown) {
                    parseErrors[name] = (e as Error).message;
                }
            }
            expect(parseErrors).toEqual({});
        });

        it('every subscription validates against schema.graphql (correct types, fields, arguments)', () => {
            const validationFailures: Record<string, string[]> = {};
            for (const [name, source] of Object.entries(subscriptions)) {
                const errors = validateOperation(schema, source);
                if (errors.length > 0) {
                    validationFailures[name] = errors;
                }
            }
            expect(validationFailures).toEqual({});
        });
    });

    // -----------------------------------------------------------------------
    // Sanity check: .js files (known-good) should all pass
    // -----------------------------------------------------------------------
    describe('mutations.js — baseline: all operations should be schema-valid', () => {
        let mutations: Record<string, string>;

        beforeAll(async () => {
            mutations = await loadOperationStrings('mutations.js');
        });

        it('every .js mutation validates against schema.graphql', () => {
            const validationFailures: Record<string, string[]> = {};
            for (const [name, source] of Object.entries(mutations)) {
                const errors = validateOperation(schema, source);
                if (errors.length > 0) {
                    validationFailures[name] = errors;
                }
            }
            expect(validationFailures).toEqual({});
        });
    });

    describe('queries.js — baseline: all operations should be schema-valid', () => {
        let queries: Record<string, string>;

        beforeAll(async () => {
            queries = await loadOperationStrings('queries.js');
        });

        it('every .js query validates against schema.graphql', () => {
            const validationFailures: Record<string, string[]> = {};
            for (const [name, source] of Object.entries(queries)) {
                const errors = validateOperation(schema, source);
                if (errors.length > 0) {
                    validationFailures[name] = errors;
                }
            }
            expect(validationFailures).toEqual({});
        });
    });

    describe('subscriptions.js — baseline: all operations should be schema-valid', () => {
        let subscriptions: Record<string, string>;

        beforeAll(async () => {
            subscriptions = await loadOperationStrings('subscriptions.js');
        });

        it('every .js subscription validates against schema.graphql', () => {
            const validationFailures: Record<string, string[]> = {};
            for (const [name, source] of Object.entries(subscriptions)) {
                const errors = validateOperation(schema, source);
                if (errors.length > 0) {
                    validationFailures[name] = errors;
                }
            }
            expect(validationFailures).toEqual({});
        });
    });
});
