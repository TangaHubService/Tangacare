export const TWO_ORGANIZATIONS_FIXTURE = {
    organizations: {
        alpha: {
            id: 7,
            name: 'Alpha Health',
            code: 'ALPHA',
        },
        beta: {
            id: 8,
            name: 'Beta Care',
            code: 'BETA',
        },
    },
    facilities: {
        alphaMain: {
            id: 101,
            organization_id: 7,
            name: 'Alpha Main Pharmacy',
        },
        betaMain: {
            id: 202,
            organization_id: 8,
            name: 'Beta Main Pharmacy',
        },
    },
    medicines: {
        alphaAmoxicillin: {
            id: 301,
            organization_id: 7,
            code: 'AMOX-500',
            name: 'Amoxicillin 500mg',
            normalized_name: 'amoxicillin 500mg',
            barcode: '1234567890',
        },
        betaAmoxicillin: {
            id: 302,
            organization_id: 8,
            code: 'AMOX-500',
            name: 'Amoxicillin 500mg',
            normalized_name: 'amoxicillin 500mg',
            barcode: '1234567890',
        },
        legacyAmoxicillin: {
            id: 303,
            organization_id: null,
            code: 'AMOX-500',
            name: 'Amoxicillin 500mg',
            normalized_name: 'amoxicillin 500mg',
            barcode: '1234567890',
        },
    },
} as const;

export const ORG_ALPHA_ID = TWO_ORGANIZATIONS_FIXTURE.organizations.alpha.id;
export const ORG_BETA_ID = TWO_ORGANIZATIONS_FIXTURE.organizations.beta.id;
