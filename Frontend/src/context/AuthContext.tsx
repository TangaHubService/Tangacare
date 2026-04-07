import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
    isSuperAdmin,
    type User,
    type LoginCredentials,
    type RegisterCredentials,
    type Organization,
} from '../types/auth';
import { authService } from '../services/auth.service';
import { pharmacyService } from '../services/pharmacy.service';
import { getEffectivePermissions } from '../lib/rolePermissions';

const ORG_KEY = 'selected_organization_id';
const FACILITY_KEY = 'selected_facility_id';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    organizationId: number | null;
    facilityId: number | null;
    currentOrg: Organization | null;
    currentFacility: { id: number; name: string; type?: string; organization_id?: number } | null;
    organizations: Organization[];
    facilities: Array<{ id: number; name: string; type?: string; organization_id?: number }>;
    setOrganization: (id: number | null) => void;
    setFacility: (id: number | null) => void;
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (credentials: RegisterCredentials) => Promise<void>;
    logout: () => Promise<void>;
    refreshProfile: () => Promise<void>;

    can: (permission: string) => boolean;
    isOwner: boolean;
    hasOrganization: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [organizationId, setOrganizationIdState] = useState<number | null>(() => {
        const v = localStorage.getItem(ORG_KEY);
        return v ? parseInt(v, 10) : null;
    });
    const [facilityId, setFacilityIdState] = useState<number | null>(() => {
        const v = localStorage.getItem(FACILITY_KEY);
        return v ? parseInt(v, 10) : null;
    });
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [facilities, setFacilities] = useState<
        Array<{ id: number; name: string; type?: string; organization_id?: number }>
    >([]);

    const setOrganization = useCallback((id: number | null) => {
        if (id !== null) localStorage.setItem(ORG_KEY, String(id));
        else localStorage.removeItem(ORG_KEY);

        // When switching organization, clear facility to trigger aggregated view for high-privilege roles
        localStorage.removeItem(FACILITY_KEY);
        setFacilityIdState(null);

        setOrganizationIdState(id);
    }, []);

    const setFacility = useCallback((id: number | null) => {
        if (id !== null) localStorage.setItem(FACILITY_KEY, String(id));
        else localStorage.removeItem(FACILITY_KEY);
        setFacilityIdState(id);
    }, []);

    const resolveAndSetDefaultScope = useCallback((profile: any) => {
        const role = (profile.role || profile.user_role)?.toString().toUpperCase();
        const isHighLevel = role === 'OWNER' || role === 'ADMIN' || isSuperAdmin(role);

        let fid = localStorage.getItem(FACILITY_KEY);
        let oid = localStorage.getItem(ORG_KEY);

        // 1. Resolve Facility Default
        if (!fid) {
            if (isHighLevel) {
                // High level roles default to All Facilities (null) for aggregated data
                fid = null;
            } else {
                // Fixed roles default to their primary assigned facility
                const defaultFac = profile.facility ?? profile.facilities?.[0] ?? null;
                fid = defaultFac?.id ? String(defaultFac.id) : null;
            }
        }

        // 2. Resolve Organization Default
        if (!oid) {
            const selectedFacility = profile.facilities?.find((f: any) => String(f.id) === fid);
            const resolvedOid =
                selectedFacility?.organization_id ??
                profile.organizations?.[0]?.id ??
                profile.organization_id ??
                null;
            oid = resolvedOid ? String(resolvedOid) : null;
        }

        // 3. Persist and Update State
        if (fid) localStorage.setItem(FACILITY_KEY, fid);
        else localStorage.removeItem(FACILITY_KEY);

        if (oid) localStorage.setItem(ORG_KEY, oid);
        else localStorage.removeItem(ORG_KEY);

        setOrganizationIdState(oid ? parseInt(oid, 10) : null);
        setFacilityIdState(fid ? parseInt(fid, 10) : null);
    }, []);

    const checkAuth = async () => {
        const token = localStorage.getItem('access_token');
        const storedUser = localStorage.getItem('user_data');

        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                setUser(parsed);
                if (parsed.organizations) setOrganizations(parsed.organizations);
                if (parsed.facilities) setFacilities(parsed.facilities);
            } catch {
                setUser(null);
            }
        }

        if (token) {
            try {
                const profile = await authService.getProfile();
                let orgs = profile.organizations || [];

                // For super_admin users, fetch organizations if not returned from profile
                const userRole = (profile?.role || profile?.user_role || '')
                    .toString()
                    .toUpperCase();
                const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPER ADMIN';

                if (isSuperAdmin && (!orgs || orgs.length === 0)) {
                    try {
                        const orgsBody = await pharmacyService.getOrganizations({ limit: 100 });
                        orgs = orgsBody.data || [];
                    } catch (e) {
                        console.error(
                            'Failed to fetch organizations for super_admin during checkAuth:',
                            e,
                        );
                    }
                }

                if (orgs) setOrganizations(orgs);

                // Fetch full facility list immediately if we have an organization ID
                const oid = profile.organization_id || orgs?.[0]?.id;
                if (oid) {
                    try {
                        localStorage.setItem(ORG_KEY, String(oid));
                        setOrganizationIdState(oid);
                        const facsBody = await pharmacyService.getFacilities({ limit: 100 });
                        setFacilities(facsBody.data || []);
                    } catch (e) {
                        console.error('Failed to fetch facilities during checkAuth:', e);
                        if (profile.facilities) setFacilities(profile.facilities);
                    }
                } else if (profile.facilities) {
                    setFacilities(profile.facilities);
                }

                // Set these immediately before resolving scope to ensure context matches
                localStorage.setItem('user_data', JSON.stringify(profile));
                setUser(profile);

                resolveAndSetDefaultScope(profile);
            } catch (error) {
                console.error('Failed to fetch profile:', error);
                await authService.logout();
                localStorage.removeItem('user_data');
                setUser(null);
                setOrganizations([]);
                setFacilities([]);
            }
        }
        setIsLoading(false);
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const login = async (credentials: LoginCredentials) => {
        setIsLoading(true);
        try {
            const response = await authService.login(credentials);
            const payload = response?.data ?? response;
            const u = payload?.user;
            let orgs = u?.organizations ?? [];
            setOrganizations(Array.isArray(orgs) ? orgs : []);

            // For super_admin users, fetch organizations if not returned from login
            const userRole = (u?.role || u?.user_role || '').toString().toUpperCase();
            const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPER ADMIN';

            if (isSuperAdmin && (!orgs || orgs.length === 0)) {
                try {
                    const orgsBody = await pharmacyService.getOrganizations({ limit: 100 });
                    orgs = orgsBody.data || [];
                    setOrganizations(orgs);
                } catch (e) {
                    console.error('Failed to fetch organizations for super_admin during login:', e);
                }
            }

            // Fetch full facility list immediately
            const oid = u?.organization_id || orgs[0]?.id;
            if (oid) {
                try {
                    localStorage.setItem(ORG_KEY, String(oid));
                    setOrganizationIdState(oid);
                    const facsBody = await pharmacyService.getFacilities({ limit: 100 });
                    setFacilities(facsBody.data || []);
                } catch (e) {
                    console.error('Failed to fetch facilities during login:', e);
                    setFacilities(Array.isArray(u?.facilities) ? u.facilities : []);
                }
            } else {
                setFacilities(Array.isArray(u?.facilities) ? u.facilities : []);
            }

            // Resolve and set scope BEFORE setting user to ensure context is ready
            resolveAndSetDefaultScope(u);
            setUser(u);
        } catch (error) {
            setIsLoading(false);
            throw error;
        }
        setIsLoading(false);
    };

    const register = async (credentials: RegisterCredentials) => {
        setIsLoading(true);
        try {
            await authService.register(credentials);
        } catch (error) {
            setIsLoading(false);
            throw error;
        }
        setIsLoading(false);
    };

    const logout = async () => {
        await authService.logout();
        setUser(null);
        setOrganizations([]);
        setFacilities([]);
        setOrganizationIdState(null);
        setFacilityIdState(null);
    };

    const refreshProfile = async () => {
        const profile = await authService.getProfile();
        let orgs = profile.organizations || [];

        // For super_admin users, fetch organizations if not returned from profile
        const userRole = (profile?.role || profile?.user_role || '').toString().toUpperCase();
        const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'SUPER ADMIN';

        if (isSuperAdmin && (!orgs || orgs.length === 0)) {
            try {
                const orgsBody = await pharmacyService.getOrganizations({ limit: 100 });
                orgs = orgsBody.data || [];
            } catch (e) {
                console.error(
                    'Failed to fetch organizations for super_admin during refreshProfile:',
                    e,
                );
            }
        }

        setUser(profile);
        localStorage.setItem('user_data', JSON.stringify(profile));
        if (orgs) setOrganizations(orgs);

        const oid = profile.organization_id || orgs?.[0]?.id;
        if (oid) {
            try {
                localStorage.setItem(ORG_KEY, String(oid));
                setOrganizationIdState(oid);
                const facsBody = await pharmacyService.getFacilities({ limit: 100 });
                setFacilities(facsBody.data || []);
            } catch (e) {
                console.error('Failed to fetch facilities during refreshProfile:', e);
                if (profile.facilities) setFacilities(profile.facilities);
            }
        } else if (profile.facilities) {
            setFacilities(profile.facilities);
        }

        resolveAndSetDefaultScope(profile);
    };

    const can = useCallback(
        (permission: string) => {
            const u = user;
            if (!u) return false;
            if (isSuperAdmin(u.role) || u.role?.toString().toUpperCase() === 'OWNER') return true;
            return getEffectivePermissions(u).includes(permission);
        },
        [user],
    );

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                organizationId,
                facilityId,
                currentOrg: organizations.find((o) => o.id === organizationId) || null,
                currentFacility: facilities.find((f) => f.id === facilityId) || null,
                organizations,
                facilities,
                setOrganization,
                setFacility,
                login,
                register,
                logout,
                refreshProfile,
                can,
                isOwner:
                    user?.role?.toString().toUpperCase() === 'OWNER' ||
                    user?.user_role?.toString().toUpperCase() === 'OWNER',
                hasOrganization: (user?.organizations?.length ?? 0) > 0 || !!user?.organization_id,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
