import fs from 'fs';
import path from 'path';
import { swaggerSpec } from '../src/config/swagger';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

const METHOD_ORDER: readonly HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'] as const;

const ensureDir = (dirPath: string): void => {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const extractPathParams = (p: string): string[] => {
    const matches = p.match(/:([A-Za-z0-9_]+)/g) ?? [];
    return matches.map((m) => m.substring(1));
};

const buildDefaultVarValue = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('token')) return 'sample-token';
    if (lower === 'id' || lower.endsWith('id') || lower.endsWith('_id')) return '1';
    if (lower.includes('date')) return '2026-03-04';
    return '1';
};

const hasRefParam = (op: any, needle: string): boolean => {
    const params = op?.parameters ?? [];
    return params.some((p: any) => typeof p?.$ref === 'string' && p.$ref.includes(needle));
};

const toPostmanPath = (openApiPath: string): string => openApiPath.replace(/:([A-Za-z0-9_]+)/g, '{{$1}}');

const buildUrlObject = (rawPath: string, withPagination: boolean): any => {
    const pathNoLeading = rawPath.replace(/^\//, '');
    const pathSegments = pathNoLeading.split('/').filter(Boolean);
    const url: any = {
        raw: `{{base_url}}${rawPath}`,
        host: ['{{base_url}}'],
        path: pathSegments,
    };

    if (withPagination) {
        url.query = [
            { key: 'page', value: '1' },
            { key: 'limit', value: '10' },
        ];
        url.raw = `{{base_url}}${rawPath}?page=1&limit=10`;
    }

    return url;
};

const buildRequestBody = (op: any, schemas: Record<string, any>): { body?: any; headers?: any[] } => {
    const content = op?.requestBody?.content;
    if (!content) return {};

    if (content['application/json']?.schema?.$ref) {
        const ref: string = content['application/json'].schema.$ref;
        const schemaName = ref.split('/').pop() ?? '';
        const example = schemas?.[schemaName]?.example ?? {};

        return {
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
                mode: 'raw',
                raw: JSON.stringify(example, null, 2),
            },
        };
    }

    if (content['multipart/form-data']?.schema?.properties) {
        const props = content['multipart/form-data'].schema.properties;
        const [fieldName] = Object.keys(props);
        if (!fieldName) return {};

        return {
            body: {
                mode: 'formdata',
                formdata: [
                    {
                        key: fieldName,
                        type: 'file',
                        src: '',
                    },
                ],
            },
        };
    }

    return {};
};

const buildPostmanItem = (openApiPath: string, method: HttpMethod, op: any, schemas: Record<string, any>): any => {
    const postmanPath = toPostmanPath(openApiPath);
    const needsPagination = hasRefParam(op, '/Page') || hasRefParam(op, '/Limit');
    const needsScope = hasRefParam(op, '/XOrganizationId') || hasRefParam(op, '/XFacilityId') || hasRefParam(op, '/XTenantId');
    const needsAuth = Array.isArray(op?.security) && op.security.some((s: any) => s && typeof s === 'object' && 'bearerAuth' in s);

    const headers: any[] = [];
    if (needsAuth) headers.push({ key: 'Authorization', value: 'Bearer {{access_token}}' });
    if (needsScope) {
        headers.push({ key: 'x-organization-id', value: '{{organization_id}}' });
        headers.push({ key: 'x-facility-id', value: '{{facility_id}}' });
    }

    const { body, headers: bodyHeaders } = buildRequestBody(op, schemas);
    if (bodyHeaders) headers.push(...bodyHeaders);

    const item: any = {
        name: op?.summary || `${method.toUpperCase()} ${openApiPath}`,
        request: {
            method: method.toUpperCase(),
            header: headers,
            url: buildUrlObject(postmanPath, needsPagination),
            description: op?.description,
        },
    };

    if (body) item.request.body = body;

    if (openApiPath === '/api/auth/login' && method === 'post') {
        item.event = [
            {
                listen: 'test',
                script: {
                    exec: [
                        'const response = pm.response.json();',
                        'if (response.data && response.data.tokens) {',
                        "  pm.environment.set('access_token', response.data.tokens.accessToken);",
                        "  pm.environment.set('refresh_token', response.data.tokens.refreshToken);",
                        '}',
                    ],
                },
            },
        ];
    }

    return item;
};

const generatePostmanCollection = (spec: any): any => {
    const schemas = spec?.components?.schemas ?? {};
    const paths = spec?.paths ?? {};

    const tags = new Map<string, any>();
    const itemsByTag = new Map<string, any[]>();

    for (const tag of spec?.tags ?? []) {
        if (tag?.name) tags.set(tag.name, tag);
    }

    const allPathParams = new Set<string>();
    for (const p of Object.keys(paths)) {
        for (const name of extractPathParams(p)) allPathParams.add(name);
    }

    const variables = [
        { key: 'base_url', value: 'http://localhost:3000', type: 'string' },
        { key: 'access_token', value: '', type: 'string' },
        { key: 'refresh_token', value: '', type: 'string' },
        { key: 'organization_id', value: '', type: 'string' },
        { key: 'facility_id', value: '', type: 'string' },
        ...[...allPathParams]
            .sort()
            .map((key) => ({ key, value: buildDefaultVarValue(key), type: 'string' as const })),
    ];

    const sortedPaths = Object.keys(paths).sort();
    for (const p of sortedPaths) {
        const pathItem = paths[p] ?? {};
        for (const method of METHOD_ORDER) {
            const op = pathItem[method];
            if (!op) continue;
            const tagName = op?.tags?.[0] ?? 'Other';
            if (!itemsByTag.has(tagName)) itemsByTag.set(tagName, []);
            itemsByTag.get(tagName)!.push(buildPostmanItem(p, method, op, schemas));
        }
    }

    const folders = [...itemsByTag.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([tagName, requests]) => ({
            name: tagName,
            description: tags.get(tagName)?.description,
            item: requests.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        }));

    return {
        info: {
            name: 'Tangacare API',
            _postman_id: 'tangacare-api-collection',
            description:
                'Generated Postman collection for the Tangacare API. Source of truth: OpenAPI spec available at `/api-docs.json` when the server is running.',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        variable: variables,
        item: folders,
    };
};

const main = (): void => {
    const repoRoot = path.resolve(__dirname, '..');
    const docsDir = path.join(repoRoot, 'docs');
    ensureDir(docsDir);

    const openApiPath = path.join(docsDir, 'openapi.json');
    fs.writeFileSync(openApiPath, JSON.stringify(swaggerSpec, null, 4));

    const postmanCollection = generatePostmanCollection(swaggerSpec);
    const postmanPath = path.join(repoRoot, 'Tangacare.postman_collection.json');
    fs.writeFileSync(postmanPath, JSON.stringify(postmanCollection, null, 4));

    // eslint-disable-next-line no-console
    console.log(`✅ Wrote ${path.relative(repoRoot, openApiPath)}`);
    // eslint-disable-next-line no-console
    console.log(`✅ Updated ${path.relative(repoRoot, postmanPath)}`);
};

main();

