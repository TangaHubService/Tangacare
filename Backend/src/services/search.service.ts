import { Repository } from 'typeorm';
import { Doctor } from '../entities/Doctor.entity';
import { AppDataSource } from '../config/database';

export class SearchService {
    private doctorRepository: Repository<Doctor>;

    constructor() {
        this.doctorRepository = AppDataSource.getRepository(Doctor);
    }

    async searchDoctors(query: string): Promise<Doctor[]> {
        if (!query || query.trim().length === 0) {
            return [];
        }

        const searchTerm = `%${query}%`;

        const doctors = await this.doctorRepository
            .createQueryBuilder('doctor')
            .leftJoinAndSelect('doctor.user', 'user')
            .where('doctor.specialization ILIKE :searchTerm', { searchTerm })
            .orWhere('doctor.bio ILIKE :searchTerm', { searchTerm })
            .orWhere('user.first_name ILIKE :searchTerm', { searchTerm })
            .orWhere('user.last_name ILIKE :searchTerm', { searchTerm })
            .orWhere("CONCAT(user.first_name, ' ', user.last_name) ILIKE :searchTerm", { searchTerm })
            .andWhere('doctor.is_available = :isAvailable', { isAvailable: true })
            .orderBy('doctor.rating', 'DESC')
            .limit(20)
            .getMany();

        return doctors;
    }

    async searchAll(query: string): Promise<{
        doctors: Doctor[];
    }> {
        const doctors = await this.searchDoctors(query);

        return {
            doctors,
        };
    }
}
