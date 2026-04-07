import fs from 'fs';
import path from 'path';
import ts from 'typescript';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface RouteMount {
    mountPath: string;
    routeFilePath: string;
    exportName: string; // 'default' or named export
}

interface RouterRoute {
    method: HttpMethod;
    path: string;
    handlerName?: string;
    metadata: RouteMetadata;
}

interface RouteMetadata {
    requiresAuth: boolean;
    usesScope: boolean;
    usesFacilityScope: boolean;
    dtoName?: string;
    fileUpload?: { fieldName: string; kind: 'single' | 'array' };
    roles: string[];
    permissions: string[];
}

interface ParsedRouteFile {
    routerVars: Map<string, { globalMetadata: RouteMetadata; routes: RouterRoute[] }>;
    exports: { defaultExport?: string; namedExports: Set<string> };
}

const HTTP_METHODS: readonly HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'] as const;

const DEFAULT_API_PREFIX = '/api';

const TAGS_BY_MOUNT: Record<
    string,
    {
        name: string;
        description: string;
    }
> = {
    '/api/auth': { name: 'Authentication', description: 'User authentication and authorization' },
    '/api/users': { name: 'Users', description: 'User management' },
    '/api/doctors': { name: 'Doctors', description: 'Doctor profiles and management' },
    '/api/appointments': { name: 'Appointments', description: 'Appointment scheduling and management' },
    '/api/prescriptions': { name: 'Prescriptions', description: 'Medical prescriptions' },
    '/api/payments': { name: 'Payments', description: 'Payment processing' },
    '/api/health-records': { name: 'Health Records', description: 'Patient health records' },
    '/api/health-tips': { name: 'Health Tips', description: 'Health education content' },
    '/api/reviews': { name: 'Reviews', description: 'Doctor ratings and reviews (success stories)' },
    '/api/search': { name: 'Search', description: 'Global search for doctors and specialists' },
    '/api/chat': { name: 'Chat', description: 'Real-time messaging between doctors and patients' },
    '/api/calls': { name: 'Calls', description: 'Call history and call details' },
    '/api/public': { name: 'Public', description: 'Public endpoints (no authentication)' },

    '/api/pharmacy/organizations': { name: 'Pharmacy - Organizations', description: 'Organization management' },
    '/api/pharmacy/onboarding': { name: 'Pharmacy - Onboarding', description: 'Organization/facility onboarding flows' },
    '/api/pharmacy/invitations': { name: 'Pharmacy - Invitations', description: 'Staff invitations and access management' },
    '/api/pharmacy/facilities': {
        name: 'Pharmacy - Facilities',
        description: 'Facility management (hospitals, clinics, pharmacy shops)',
    },
    '/api/pharmacy/departments': { name: 'Pharmacy - Departments', description: 'Department management (for hospitals)' },
    '/api/pharmacy/medicines': { name: 'Pharmacy - Medicines', description: 'Medicine catalog management' },
    '/api/pharmacy/categories': { name: 'Pharmacy - Categories', description: 'Medicine categorization' },
    '/api/pharmacy/batches': { name: 'Pharmacy - Batches', description: 'Batch and expiry date management' },
    '/api/pharmacy/stock': { name: 'Pharmacy - Stock', description: 'Stock level management' },
    '/api/pharmacy/suppliers': { name: 'Pharmacy - Suppliers', description: 'Supplier management' },
    '/api/pharmacy/procurement': { name: 'Pharmacy - Procurement', description: 'Purchase orders and receiving' },
    '/api/pharmacy/dispensing': { name: 'Pharmacy - Dispensing', description: 'Medicine dispensing and sales' },
    '/api/pharmacy/alerts': { name: 'Pharmacy - Alerts', description: 'Stock and expiry alerts' },
    '/api/pharmacy/stock-transfers': { name: 'Pharmacy - Stock Transfers', description: 'Inter-department stock transfers' },
    '/api/pharmacy/reports': { name: 'Pharmacy - Reports', description: 'Analytics and reporting endpoints' },
    '/api/pharmacy/audit-logs': { name: 'Pharmacy - Audit Logs', description: 'Audit trails for inventory actions' },
    '/api/pharmacy/sales': { name: 'Pharmacy - Sales', description: 'Sales and cashier operations' },
    '/api/pharmacy/returns': { name: 'Pharmacy - Returns', description: 'Customer returns and adjustments' },
    '/api/pharmacy/vendor-returns': { name: 'Pharmacy - Vendor Returns', description: 'Returns back to suppliers/vendors' },
    '/api/pharmacy/disposals': { name: 'Pharmacy - Disposals', description: 'Disposal requests and workflows' },
    '/api/pharmacy/kpis': { name: 'Pharmacy - KPIs', description: 'Operational KPIs and scorecards' },
    '/api/pharmacy/insurance': { name: 'Pharmacy - Insurance', description: 'Insurance billing, claims and approvals' },
    '/api/pharmacy/analytics': { name: 'Pharmacy - Analytics', description: 'Analytics endpoints and insights' },
    '/api/pharmacy/physical-counts': { name: 'Pharmacy - Physical Counts', description: 'Stock physical count sessions' },
    '/api/pharmacy/recalls': { name: 'Pharmacy - Recalls', description: 'Product recalls and safety actions' },
    '/api/pharmacy/variances': { name: 'Pharmacy - Variances', description: 'Stock variance tracking and approvals' },
    '/api/pharmacy/storage-locations': { name: 'Pharmacy - Storage Locations', description: 'Storage locations and bins' },
    '/api/pharmacy': { name: 'Pharmacy - Dashboard', description: 'Pharmacy dashboard endpoints' },
};

const normalizePath = (p: string): string => {
    if (!p) return '/';
    if (p === '/') return '/';
    return p.startsWith('/') ? p.replace(/\/+$/, '') : `/${p.replace(/\/+$/, '')}`;
};

const joinPaths = (base: string, suffix: string): string => {
    const left = normalizePath(base);
    const right = suffix === '/' ? '' : suffix.startsWith('/') ? suffix : `/${suffix}`;
    const combined = `${left}${right}`.replace(/\/{2,}/g, '/');
    return combined === '' ? '/' : combined;
};

const camelToTitle = (input: string): string => {
    const withSpaces = input
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim();
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
};

const toPascalCase = (input: string): string => {
    const cleaned = input.replace(/[^A-Za-z0-9]+/g, ' ').trim();
    if (!cleaned) return '';
    return cleaned
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
};

const unwrapToIdentifier = (expr: ts.Expression): ts.Identifier | undefined => {
    let current: ts.Expression = expr;
    while (true) {
        if (ts.isIdentifier(current)) return current;
        if (ts.isAsExpression(current)) {
            current = current.expression;
            continue;
        }
        if (ts.isParenthesizedExpression(current)) {
            current = current.expression;
            continue;
        }
        return undefined;
    }
};

const extractStringLiteral = (expr: ts.Expression): string | undefined => {
    if (ts.isStringLiteral(expr)) return expr.text;
    if (ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
    return undefined;
};

const createEmptyMetadata = (): RouteMetadata => ({
    requiresAuth: false,
    usesScope: false,
    usesFacilityScope: false,
    roles: [],
    permissions: [],
});

const mergeMetadata = (a: RouteMetadata, b: RouteMetadata): RouteMetadata => ({
    requiresAuth: a.requiresAuth || b.requiresAuth,
    usesScope: a.usesScope || b.usesScope,
    usesFacilityScope: a.usesFacilityScope || b.usesFacilityScope,
    dtoName: b.dtoName ?? a.dtoName,
    fileUpload: b.fileUpload ?? a.fileUpload,
    roles: [...new Set([...a.roles, ...b.roles])],
    permissions: [...new Set([...a.permissions, ...b.permissions])],
});

const extractRoles = (args: readonly ts.Expression[]): string[] => {
    const roles: string[] = [];
    for (const arg of args) {
        if (ts.isPropertyAccessExpression(arg)) {
            roles.push(arg.name.text);
        } else if (ts.isIdentifier(arg)) {
            roles.push(arg.text);
        }
    }
    return roles;
};

const extractPermissions = (args: readonly ts.Expression[]): string[] => {
    const permissions: string[] = [];
    for (const arg of args) {
        if (ts.isPropertyAccessExpression(arg)) {
            permissions.push(arg.name.text);
        } else if (ts.isIdentifier(arg)) {
            permissions.push(arg.text);
        }
    }
    return permissions;
};

const analyzeMiddlewareExpression = (expr: ts.Expression): RouteMetadata => {
    const meta = createEmptyMetadata();

    if (ts.isIdentifier(expr)) {
        if (expr.text === 'authenticate') meta.requiresAuth = true;
        if (expr.text === 'scopeMiddleware') meta.usesScope = true;
        if (expr.text === 'requireFacilityScope') meta.usesFacilityScope = true;
        return meta;
    }

    if (ts.isCallExpression(expr)) {
        const callee = expr.expression;

        if (ts.isIdentifier(callee) && callee.text === 'authorize') {
            meta.requiresAuth = true;
            meta.roles = extractRoles(expr.arguments);
            return meta;
        }

        if (ts.isIdentifier(callee) && callee.text === 'requirePermission') {
            meta.requiresAuth = true;
            meta.permissions = extractPermissions(expr.arguments);
            return meta;
        }

        if (ts.isIdentifier(callee) && callee.text === 'validateDto') {
            const dtoArg = expr.arguments[0];
            if (dtoArg && ts.isIdentifier(dtoArg)) {
                meta.dtoName = dtoArg.text;
            }
            return meta;
        }

        if (ts.isPropertyAccessExpression(callee)) {
            const receiver = unwrapToIdentifier(callee.expression);
            const member = callee.name.text;

            if (receiver && receiver.text === 'upload' && (member === 'single' || member === 'array')) {
                const field = expr.arguments[0];
                const fieldName = field ? extractStringLiteral(field) : undefined;
                if (fieldName) {
                    meta.fileUpload = { fieldName, kind: member };
                }
                return meta;
            }
        }
    }

    return meta;
};

const analyzeMiddlewares = (expressions: readonly ts.Expression[]): RouteMetadata => {
    let meta = createEmptyMetadata();
    for (const expr of expressions) {
        meta = mergeMetadata(meta, analyzeMiddlewareExpression(expr));
    }
    return meta;
};

const parseRouteFile = (routeFilePath: string): ParsedRouteFile => {
    const fileText = fs.readFileSync(routeFilePath, 'utf8');
    const sourceFile = ts.createSourceFile(routeFilePath, fileText, ts.ScriptTarget.Latest, true);

    const routerVars = new Map<string, { globalMetadata: RouteMetadata; routes: RouterRoute[] }>();
    const exports: ParsedRouteFile['exports'] = { namedExports: new Set<string>() };

    const ensureRouter = (routerName: string): void => {
        if (!routerVars.has(routerName)) {
            routerVars.set(routerName, { globalMetadata: createEmptyMetadata(), routes: [] });
        }
    };

    // 1) Find router variables (const X = Router();)
    for (const stmt of sourceFile.statements) {
        if (!ts.isVariableStatement(stmt)) continue;
        for (const decl of stmt.declarationList.declarations) {
            if (!ts.isIdentifier(decl.name)) continue;
            const init = decl.initializer;
            if (!init || !ts.isCallExpression(init)) continue;
            if (ts.isIdentifier(init.expression) && init.expression.text === 'Router') {
                ensureRouter(decl.name.text);
            }
        }
    }

    const visit = (node: ts.Node): void => {
        if (ts.isExportAssignment(node)) {
            if (ts.isIdentifier(node.expression)) {
                exports.defaultExport = node.expression.text;
            }
        }

        if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
            for (const el of node.exportClause.elements) {
                exports.namedExports.add(el.name.text);
            }
        }

        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            const methodName = node.expression.name.text;
            const receiverId = unwrapToIdentifier(node.expression.expression);

            if (receiverId && routerVars.has(receiverId.text)) {
                ensureRouter(receiverId.text);
                const router = routerVars.get(receiverId.text)!;

                if (methodName === 'use') {
                    const args = [...node.arguments];
                    const argsWithoutPath = args.length > 0 && extractStringLiteral(args[0]) ? args.slice(1) : args;
                    router.globalMetadata = mergeMetadata(router.globalMetadata, analyzeMiddlewares(argsWithoutPath));
                } else if ((HTTP_METHODS as readonly string[]).includes(methodName)) {
                    const rawPathArg = node.arguments[0];
                    if (!rawPathArg) return;
                    const routePath = extractStringLiteral(rawPathArg);
                    if (!routePath) return;

                    const remainingArgs = node.arguments.slice(1);
                    const middlewares = remainingArgs.slice(0, Math.max(0, remainingArgs.length - 1));
                    const handler = remainingArgs[remainingArgs.length - 1];

                    const handlerName =
                        handler && ts.isPropertyAccessExpression(handler)
                            ? handler.name.text
                            : handler && ts.isIdentifier(handler)
                              ? handler.text
                              : undefined;

                    const meta = analyzeMiddlewares(middlewares);

                    router.routes.push({
                        method: methodName as HttpMethod,
                        path: routePath,
                        handlerName,
                        metadata: meta,
                    });
                }
            }
        }

        ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);

    return { routerVars, exports };
};

const tryResolveRouteFile = (appDir: string, moduleSpecifier: string): string | undefined => {
    const resolved = path.resolve(appDir, moduleSpecifier);
    const candidates = [
        `${resolved}.ts`,
        `${resolved}.js`,
        `${resolved}.tsx`,
        `${resolved}.jsx`,
        path.join(resolved, 'index.ts'),
        path.join(resolved, 'index.js'),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return undefined;
};

const extractMountPath = (expr: ts.Expression, apiPrefix: string): string | undefined => {
    const direct = extractStringLiteral(expr);
    if (direct) return direct;

    if (ts.isTemplateExpression(expr)) {
        let out = expr.head.text;
        for (const span of expr.templateSpans) {
            if (ts.isIdentifier(span.expression) && span.expression.text === 'API_PREFIX') {
                out += apiPrefix;
            }
            out += span.literal.text;
        }
        return out;
    }

    return undefined;
};

const parseAppMounts = (appFilePath: string, apiPrefix: string): RouteMount[] => {
    const appDir = path.dirname(appFilePath);
    const fileText = fs.readFileSync(appFilePath, 'utf8');
    const sourceFile = ts.createSourceFile(appFilePath, fileText, ts.ScriptTarget.Latest, true);

    const importMap = new Map<string, { modulePath: string; exportName: string }>();

    for (const stmt of sourceFile.statements) {
        if (!ts.isImportDeclaration(stmt)) continue;
        const moduleSpecifier = stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier) ? stmt.moduleSpecifier.text : '';
        if (!moduleSpecifier.startsWith('./routes') && !moduleSpecifier.startsWith('../routes')) continue;

        const importClause = stmt.importClause;
        if (!importClause) continue;

        if (importClause.name) {
            importMap.set(importClause.name.text, { modulePath: moduleSpecifier, exportName: 'default' });
        }

        if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
            for (const el of importClause.namedBindings.elements) {
                const localName = el.name.text;
                const exportName = el.propertyName ? el.propertyName.text : el.name.text;
                importMap.set(localName, { modulePath: moduleSpecifier, exportName });
            }
        }
    }

    const mounts: RouteMount[] = [];

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            const receiver = node.expression.expression;
            const methodName = node.expression.name.text;
            if (methodName === 'use' && ts.isIdentifier(receiver) && receiver.text === 'app') {
                const [mountExpr, routerExpr] = node.arguments;
                if (!mountExpr || !routerExpr || !ts.isIdentifier(routerExpr)) {
                    ts.forEachChild(node, visit);
                    return;
                }

                const importInfo = importMap.get(routerExpr.text);
                if (!importInfo) {
                    ts.forEachChild(node, visit);
                    return;
                }

                const mountPath = extractMountPath(mountExpr, apiPrefix);
                const routeFilePath = tryResolveRouteFile(appDir, importInfo.modulePath);

                if (mountPath && routeFilePath) {
                    mounts.push({
                        mountPath,
                        routeFilePath,
                        exportName: importInfo.exportName,
                    });
                }
            }
        }

        ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);

    return mounts;
};

const listDtoFiles = (dtoDir: string): string[] => {
    if (!fs.existsSync(dtoDir)) return [];
    return fs
        .readdirSync(dtoDir)
        .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
        .map((f) => path.join(dtoDir, f));
};

const findEnumValuesInFile = (filePath: string, enumName: string): string[] | undefined => {
    if (!fs.existsSync(filePath)) return undefined;
    const fileText = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, fileText, ts.ScriptTarget.Latest, true);

    for (const stmt of sourceFile.statements) {
        if (ts.isEnumDeclaration(stmt) && stmt.name.text === enumName) {
            const values: string[] = [];
            for (const member of stmt.members) {
                const init = member.initializer;
                if (init && ts.isStringLiteral(init)) {
                    values.push(init.text);
                } else if (init && ts.isNumericLiteral(init)) {
                    values.push(init.text);
                } else if (ts.isIdentifier(member.name)) {
                    values.push(member.name.text);
                } else if (ts.isStringLiteral(member.name)) {
                    values.push(member.name.text);
                }
            }
            return values.length > 0 ? values : undefined;
        }
    }

    return undefined;
};

const extractIsEnumValues = (
    propDecorators: readonly ts.Decorator[],
    importMap: Map<string, string>,
    fileDir: string,
    enumCache: Map<string, string[]>,
): string[] | undefined => {
    for (const dec of propDecorators) {
        const expr = dec.expression;
        if (!ts.isCallExpression(expr)) continue;
        if (!ts.isIdentifier(expr.expression) || expr.expression.text !== 'IsEnum') continue;
        const arg = expr.arguments[0];
        if (!arg) continue;

        if (ts.isArrayLiteralExpression(arg)) {
            const values = arg.elements
                .map((el) => (ts.isStringLiteral(el) ? el.text : ts.isNumericLiteral(el) ? el.text : undefined))
                .filter((v): v is string => Boolean(v));
            if (values.length > 0) return values;
        }

        if (ts.isIdentifier(arg)) {
            const enumName = arg.text;
            const importPath = importMap.get(enumName);
            if (!importPath) continue;

            const cacheKey = `${importPath}::${enumName}`;
            const cached = enumCache.get(cacheKey);
            if (cached) return cached;

            const resolvedImport = path.resolve(fileDir, importPath);
            const candidateFiles = [
                `${resolvedImport}.ts`,
                `${resolvedImport}.js`,
                `${resolvedImport}.d.ts`,
                path.join(resolvedImport, 'index.ts'),
                path.join(resolvedImport, 'index.js'),
            ];
            for (const candidate of candidateFiles) {
                const found = findEnumValuesInFile(candidate, enumName);
                if (found) {
                    enumCache.set(cacheKey, found);
                    return found;
                }
            }
        }
    }

    return undefined;
};

const getDecoratorNumberArg = (decorators: readonly ts.Decorator[], decoratorName: string): number | undefined => {
    for (const dec of decorators) {
        const expr = dec.expression;
        if (!ts.isCallExpression(expr)) continue;
        if (!ts.isIdentifier(expr.expression) || expr.expression.text !== decoratorName) continue;
        const arg = expr.arguments[0];
        if (arg && ts.isNumericLiteral(arg)) return Number(arg.text);
    }
    return undefined;
};

const hasDecorator = (decorators: readonly ts.Decorator[], decoratorName: string): boolean => {
    return decorators.some((dec) => {
        const expr = dec.expression;
        return ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === decoratorName;
    });
};

const getDecoratorRegexArg = (decorators: readonly ts.Decorator[], decoratorName: string): string | undefined => {
    for (const dec of decorators) {
        const expr = dec.expression;
        if (!ts.isCallExpression(expr)) continue;
        if (!ts.isIdentifier(expr.expression) || expr.expression.text !== decoratorName) continue;
        const arg = expr.arguments[0];
        if (arg && ts.isRegularExpressionLiteral(arg)) return arg.text;
    }
    return undefined;
};

const typeNodeToSchema = (
    typeNode: ts.TypeNode | undefined,
    knownClassNames?: Set<string>,
): { schema: any; isArray: boolean } => {
    if (!typeNode) return { schema: { type: 'object' }, isArray: false };

    if (ts.isUnionTypeNode(typeNode)) {
        const stringLiterals = typeNode.types
            .map((t) => (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal) ? t.literal.text : undefined))
            .filter((v): v is string => Boolean(v));
        if (stringLiterals.length > 0) {
            return { schema: { type: 'string', enum: stringLiterals }, isArray: false };
        }
    }

    switch (typeNode.kind) {
        case ts.SyntaxKind.StringKeyword:
            return { schema: { type: 'string' }, isArray: false };
        case ts.SyntaxKind.NumberKeyword:
            return { schema: { type: 'number' }, isArray: false };
        case ts.SyntaxKind.BooleanKeyword:
            return { schema: { type: 'boolean' }, isArray: false };
        default:
            break;
    }

    if (ts.isArrayTypeNode(typeNode)) {
        const inner = typeNodeToSchema(typeNode.elementType, knownClassNames);
        return { schema: { type: 'array', items: inner.schema }, isArray: true };
    }

    if (ts.isTypeReferenceNode(typeNode)) {
        const typeName = ts.isIdentifier(typeNode.typeName) ? typeNode.typeName.text : undefined;
        if (typeName === 'Date') return { schema: { type: 'string', format: 'date-time' }, isArray: false };
        if (typeName && knownClassNames?.has(typeName)) {
            return { schema: { $ref: `#/components/schemas/${typeName}` }, isArray: false };
        }
        if (typeName) return { schema: { type: 'string' }, isArray: false };
    }

    return { schema: { type: 'object' }, isArray: false };
};

const buildExampleValue = (propName: string, schema: any): any => {
    if (schema && Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
    if (schema?.$ref) return {};

    const lowered = propName.toLowerCase();

    if (schema?.format === 'email' || lowered.includes('email')) return 'user@example.com';
    if (lowered.includes('phone')) return '+250788123456';
    if (lowered === 'first_name' || lowered === 'firstname' || lowered.includes('first_name')) return 'John';
    if (lowered === 'last_name' || lowered === 'lastname' || lowered.includes('last_name')) return 'Doe';
    if (lowered === 'identifier') return '+250788123456';
    if (lowered.includes('password')) return 'SecurePass123';
    if (lowered.includes('otp')) return '123456';
    if (schema?.format === 'date-time' || lowered.includes('datetime')) return new Date().toISOString();
    if (schema?.format === 'date' || lowered.endsWith('_date') || lowered.includes('date')) return '2026-03-04';
    if (lowered.endsWith('_id') || lowered === 'id' || lowered.endsWith('id')) return 1;
    if (lowered.includes('amount') || lowered.includes('fee') || lowered.includes('price')) return 1000;
    if (lowered.includes('quantity') || lowered.includes('count')) return 10;
    if (schema?.type === 'boolean') return true;

    if (schema?.type === 'integer') return 1;
    if (schema?.type === 'number') return 1;
    if (schema?.type === 'array') return [buildExampleValue(propName, schema.items ?? { type: 'string' })];
    if (schema?.type === 'object') return {};
    if (schema?.type === 'string') return 'string';

    return 'string';
};

export const generateDtoSchemasFromDir = (dtoDir: string): Record<string, any> => {
    const schemas: Record<string, any> = {};
    const enumCache = new Map<string, string[]>();
    const dtoFiles = listDtoFiles(dtoDir);

    const knownClassNames = new Set<string>();
    for (const filePath of dtoFiles) {
        const fileText = fs.readFileSync(filePath, 'utf8');
        const sourceFile = ts.createSourceFile(filePath, fileText, ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node): void => {
            if (ts.isClassDeclaration(node) && node.name) knownClassNames.add(node.name.text);
            ts.forEachChild(node, visit);
        };
        ts.forEachChild(sourceFile, visit);
    }

    for (const filePath of dtoFiles) {
        const fileText = fs.readFileSync(filePath, 'utf8');
        const sourceFile = ts.createSourceFile(filePath, fileText, ts.ScriptTarget.Latest, true);
        const fileDir = path.dirname(filePath);

        const importMap = new Map<string, string>();
        for (const stmt of sourceFile.statements) {
            if (!ts.isImportDeclaration(stmt)) continue;
            if (!stmt.importClause) continue;
            const moduleSpecifier = ts.isStringLiteral(stmt.moduleSpecifier) ? stmt.moduleSpecifier.text : '';
            const namedBindings = stmt.importClause.namedBindings;

            if (namedBindings && ts.isNamedImports(namedBindings)) {
                for (const el of namedBindings.elements) {
                    const local = el.name.text;
                    importMap.set(local, moduleSpecifier);
                }
            }
        }

        const visit = (node: ts.Node): void => {
            if (ts.isClassDeclaration(node) && node.name) {
                const className = node.name.text;

                const properties: Record<string, any> = {};
                const required: string[] = [];
                const example: Record<string, any> = {};

                for (const member of node.members) {
                    if (!ts.isPropertyDeclaration(member)) continue;
                    if (!member.name || !ts.isIdentifier(member.name)) continue;
                    const propName = member.name.text;

                    const decorators = ts.canHaveDecorators(member) ? ts.getDecorators(member) ?? [] : [];
                    const isOptional = Boolean(member.questionToken) || hasDecorator(decorators, 'IsOptional');

                    const { schema } = typeNodeToSchema(member.type, knownClassNames);

                    if (hasDecorator(decorators, 'IsEmail')) schema.format = 'email';
                    if (hasDecorator(decorators, 'IsDateString')) schema.format = 'date';
                    if (hasDecorator(decorators, 'IsInt')) schema.type = 'integer';

                    const minLen = getDecoratorNumberArg(decorators, 'MinLength');
                    const maxLen = getDecoratorNumberArg(decorators, 'MaxLength');
                    const min = getDecoratorNumberArg(decorators, 'Min');
                    const max = getDecoratorNumberArg(decorators, 'Max');

                    if (typeof minLen === 'number') schema.minLength = minLen;
                    if (typeof maxLen === 'number') schema.maxLength = maxLen;
                    if (typeof min === 'number') schema.minimum = min;
                    if (typeof max === 'number') schema.maximum = max;

                    const pattern = getDecoratorRegexArg(decorators, 'Matches');
                    if (pattern) schema.pattern = pattern;

                    const enumValues = extractIsEnumValues(decorators, importMap, fileDir, enumCache);
                    if (enumValues) {
                        schema.type = 'string';
                        schema.enum = enumValues;
                    }

                    properties[propName] = schema;

                    if (!isOptional) required.push(propName);
                    example[propName] = buildExampleValue(propName, schema);
                }

                const schema: any = {
                    type: 'object',
                    properties,
                    example,
                };
                if (required.length > 0) schema.required = required;

                // Only set/overwrite if not already present.
                if (!schemas[className]) schemas[className] = schema;
            }

            ts.forEachChild(node, visit);
        };

        ts.forEachChild(sourceFile, visit);
    }

    const hydrateExampleForSchema = (schemaName: string, depth: number, seen: Set<string>): any => {
        const schema = schemas[schemaName];
        if (!schema) return {};
        if (depth <= 0) return schema.example ?? {};
        if (seen.has(schemaName)) return schema.example ?? {};

        seen.add(schemaName);

        const example = schema.example ? JSON.parse(JSON.stringify(schema.example)) : {};
        const properties: Record<string, any> = schema.properties ?? {};

        for (const [propName, propSchema] of Object.entries(properties)) {
            if (propSchema?.$ref) {
                const refName = String(propSchema.$ref).split('/').pop();
                if (refName) example[propName] = hydrateExampleForSchema(refName, depth - 1, seen);
                continue;
            }

            if (propSchema?.type === 'array' && propSchema.items?.$ref) {
                const refName = String(propSchema.items.$ref).split('/').pop();
                if (refName) example[propName] = [hydrateExampleForSchema(refName, depth - 1, seen)];
                continue;
            }
        }

        seen.delete(schemaName);
        return example;
    };

    for (const schemaName of Object.keys(schemas)) {
        schemas[schemaName].example = hydrateExampleForSchema(schemaName, 3, new Set<string>());
    }

    return schemas;
};

const buildPathParameters = (fullPath: string): any[] => {
    const params: any[] = [];
    const matches = fullPath.match(/:([A-Za-z0-9_]+)/g) ?? [];
    for (const raw of matches) {
        const name = raw.substring(1);
        const lower = name.toLowerCase();
        const isNumeric = lower === 'id' || lower.endsWith('id') || lower.endsWith('_id');
        params.push({
            name,
            in: 'path',
            required: true,
            schema: { type: isNumeric ? 'integer' : 'string' },
        });
    }
    return params;
};

const buildOperationDescription = (meta: RouteMetadata): string | undefined => {
    const parts: string[] = [];

    if (meta.roles.length > 0) parts.push(`Roles: ${meta.roles.join(', ')}`);
    if (meta.permissions.length > 0) parts.push(`Permissions: ${meta.permissions.join(', ')}`);

    if (meta.usesScope) {
        parts.push(
            'Scope: optional headers `x-organization-id`/`x-org-id` and `x-facility-id`/`x-tenant-id` may be used by high-level roles to select a scope.',
        );
    }

    if (meta.usesFacilityScope) {
        parts.push('Facility Scope: request scope is constrained to the authenticated user facility (unless high-level role).');
    }

    if (parts.length === 0) return undefined;
    return parts.join('\n');
};

const buildSummary = (tagName: string, route: RouterRoute, fullPath: string): string => {
    if (route.handlerName) {
        const handler = route.handlerName.toLowerCase();
        const resource = tagName.replace(/^Pharmacy - /, '');

        if (handler === 'findall' && route.method === 'get') return `List ${resource}`;
        if (handler === 'findone' && route.method === 'get') return `Get ${resource}`;
        if (handler === 'create' && route.method === 'post') return `Create ${resource}`;
        if (handler === 'update' && (route.method === 'put' || route.method === 'patch')) return `Update ${resource}`;
        if (handler === 'delete' && route.method === 'delete') return `Delete ${resource}`;

        return camelToTitle(route.handlerName);
    }

    const cleaned = fullPath.replace(/\/api\/?/, '/');
    return `${route.method.toUpperCase()} ${cleaned}`;
};

const inferDtoName = (
    routeFilePath: string,
    route: RouterRoute,
    knownSchemaNames: Set<string>,
): string | undefined => {
    if (route.metadata.fileUpload) return undefined;
    if (!['post', 'put', 'patch'].includes(route.method)) return undefined;

    const fileBaseRaw = path.basename(routeFilePath).replace(/\.routes\.(ts|js|tsx|jsx)$/i, '');
    const fileBase = toPascalCase(fileBaseRaw);

    const handlerName = route.handlerName ?? '';

    const candidates: string[] = [];

    const pushCreateCandidates = (suffix: string): void => {
        if (!suffix) return;
        candidates.push(`Create${suffix}Dto`);
        candidates.push(`Create${suffix}RequestDto`);
        candidates.push(`Create${fileBase}${suffix}Dto`);
        candidates.push(`Create${fileBase}${suffix}RequestDto`);
    };

    const pushUpdateCandidates = (suffix: string): void => {
        if (!suffix) return;
        candidates.push(`Update${suffix}Dto`);
        candidates.push(`Update${suffix}RequestDto`);
        candidates.push(`Update${fileBase}${suffix}Dto`);
        candidates.push(`Update${fileBase}${suffix}RequestDto`);
    };

    if (route.method === 'post') {
        if (handlerName.startsWith('create') && handlerName.length > 'create'.length) {
            pushCreateCandidates(handlerName.substring('create'.length));
        }
        candidates.push(`Create${fileBase}Dto`);
        candidates.push(`Create${fileBase}RequestDto`);
    }

    if (route.method === 'put' || route.method === 'patch') {
        if (handlerName.startsWith('update') && handlerName.length > 'update'.length) {
            pushUpdateCandidates(handlerName.substring('update'.length));
        }
        candidates.push(`Update${fileBase}Dto`);
    }

    for (const name of candidates) {
        if (knownSchemaNames.has(name)) return name;
    }

    return undefined;
};

export const generateOpenApiPaths = (
    knownSchemaNames?: Set<string>,
): { paths: Record<string, any>; tags: { name: string; description: string }[] } => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const srcApp = path.join(repoRoot, 'src', 'app.ts');
    const distApp = path.join(repoRoot, 'dist', 'app.js');
    const appFilePath = fs.existsSync(srcApp) ? srcApp : distApp;

    const mounts = parseAppMounts(appFilePath, DEFAULT_API_PREFIX);

    const tags = new Map<string, { name: string; description: string }>();
    const paths: Record<string, any> = {};

    for (const mount of mounts) {
        const normalizedMount = normalizePath(mount.mountPath);
        const tagInfo = TAGS_BY_MOUNT[normalizedMount] ?? {
            name: normalizedMount,
            description: `Endpoints mounted at ${normalizedMount}`,
        };
        tags.set(tagInfo.name, tagInfo);

        const parsed = parseRouteFile(mount.routeFilePath);

        const routerName =
            mount.exportName === 'default'
                ? parsed.exports.defaultExport ?? (parsed.routerVars.size === 1 ? [...parsed.routerVars.keys()][0] : undefined)
                : mount.exportName;

        if (!routerName) continue;
        const routerInfo = parsed.routerVars.get(routerName);
        if (!routerInfo) continue;

        for (const route of routerInfo.routes) {
            const fullPath = joinPaths(normalizedMount, route.path);
            const mergedMeta = mergeMetadata(routerInfo.globalMetadata, route.metadata);
            const dtoName =
                mergedMeta.dtoName ??
                (knownSchemaNames ? inferDtoName(mount.routeFilePath, route, knownSchemaNames) : undefined);
            const op: any = {
                tags: [tagInfo.name],
                summary: buildSummary(tagInfo.name, route, fullPath),
                description: buildOperationDescription(mergedMeta),
                operationId: `${tagInfo.name.replace(/\W+/g, '_')}_${route.method}_${fullPath.replace(/[\/:]/g, '_')}`,
                responses: {
                    200: {
                        description: 'Success',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ApiResponse' },
                            },
                        },
                    },
                    400: {
                        description: 'Bad Request',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                    401: {
                        description: 'Unauthorized',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                    403: {
                        description: 'Forbidden',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                    404: {
                        description: 'Not Found',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                    500: {
                        description: 'Internal Server Error',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                },
                parameters: buildPathParameters(fullPath),
            };

            if (mergedMeta.requiresAuth) {
                op.security = [{ bearerAuth: [] }];
            }

            if (mergedMeta.usesScope) {
                op.parameters.push({ $ref: '#/components/parameters/XOrganizationId' });
                op.parameters.push({ $ref: '#/components/parameters/XOrgId' });
                op.parameters.push({ $ref: '#/components/parameters/XFacilityId' });
                op.parameters.push({ $ref: '#/components/parameters/XTenantId' });
            }

            const handlerLower = (route.handlerName ?? '').toLowerCase();
            const isLikelyList =
                route.method === 'get' &&
                (route.path === '/' ||
                    handlerLower === 'findall' ||
                    handlerLower === 'getall' ||
                    handlerLower.startsWith('list') ||
                    handlerLower === 'getmessages');

            if (isLikelyList) {
                op.parameters.push({ $ref: '#/components/parameters/Page' });
                op.parameters.push({ $ref: '#/components/parameters/Limit' });
            }

            if (dtoName) {
                op.requestBody = {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: `#/components/schemas/${dtoName}` },
                        },
                    },
                };
            }

            if (mergedMeta.fileUpload) {
                op.requestBody = {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    [mergedMeta.fileUpload.fieldName]: { type: 'string', format: 'binary' },
                                },
                                required: [mergedMeta.fileUpload.fieldName],
                            },
                        },
                    },
                };
            }

            if (!paths[fullPath]) paths[fullPath] = {};
            paths[fullPath][route.method] = op;
        }
    }

    // Add health check endpoint outside /api prefix
    paths['/health'] = {
        get: {
            tags: ['System'],
            summary: 'Health Check',
            operationId: 'System_get_health',
            responses: {
                200: {
                    description: 'OK',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string', example: 'OK' },
                                    timestamp: { type: 'string', format: 'date-time' },
                                    uptime: { type: 'number' },
                                },
                                required: ['status', 'timestamp', 'uptime'],
                            },
                        },
                    },
                },
            },
        },
    };
    tags.set('System', { name: 'System', description: 'System health and diagnostics' });

    return { paths, tags: [...tags.values()] };
};
