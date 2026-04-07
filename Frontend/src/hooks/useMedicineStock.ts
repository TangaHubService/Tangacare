import { useState, useEffect } from 'react';
import { pharmacyService } from '../services/pharmacy.service';
import type { Stock } from '../types/pharmacy';
import { useAuth } from '../context/AuthContext';
import { parseLocalDate } from '../lib/date';

interface MedicineStockInfo {
    nearestExpiry: string | null;
    storageLocation: string | null;
    isLoading: boolean;
    error: any;
}

export const useMedicineStock = (medicineId: number): MedicineStockInfo => {
    const { user } = useAuth();
    const [info, setInfo] = useState<MedicineStockInfo>({
        nearestExpiry: null,
        storageLocation: null,
        isLoading: true,
        error: null,
    });

    useEffect(() => {
        let isMounted = true;

        const fetchStockDetails = async () => {
            try {
                setInfo((prev) => ({ ...prev, isLoading: true }));

                const stockResponse = await pharmacyService.getStock({
                    medicine_id: medicineId,
                    ...(user?.facility_id ? { facility_id: user.facility_id } : {}),
                    page: 1,
                    limit: 100,
                });

                const now = new Date();
                const validStockRows = stockResponse.data
                    .filter((stock: Stock) => {
                        if ((stock.quantity || 0) <= 0) return false;
                        if (!stock.batch?.expiry_date) return false;
                        const expiry = parseLocalDate(stock.batch.expiry_date);
                        return !Number.isNaN(expiry.getTime()) && expiry > now;
                    })
                    .sort((a: Stock, b: Stock) => {
                        const aExpiry = parseLocalDate(a.batch!.expiry_date).getTime();
                        const bExpiry = parseLocalDate(b.batch!.expiry_date).getTime();
                        return aExpiry - bExpiry;
                    });

                const nearestStock =
                    validStockRows.find((stock) => !!stock.location?.name) || validStockRows[0];
                const nearestExpiry = nearestStock?.batch?.expiry_date || null;
                const storageLocation =
                    nearestStock?.location?.name || (nearestStock ? 'Main Shelf' : null);

                setInfo({
                    nearestExpiry,
                    storageLocation,
                    isLoading: false,
                    error: null,
                });
            } catch (err) {
                if (isMounted) {
                    setInfo((prev) => ({ ...prev, isLoading: false, error: err }));
                }
            }
        };

        if (medicineId) {
            fetchStockDetails();
        }

        return () => {
            isMounted = false;
        };
    }, [medicineId, user?.facility_id]);

    return info;
};
