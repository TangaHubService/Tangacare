import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Call, CallStatus, CallType } from '../entities/Call.entity';
import { User } from '../entities/User.entity';
import { Conversation } from '../entities/Conversation.entity';

export class CallService {
    private callRepository: Repository<Call>;
    private userRepository: Repository<User>;
    private conversationRepository: Repository<Conversation>;

    constructor() {
        this.callRepository = AppDataSource.getRepository(Call);
        this.userRepository = AppDataSource.getRepository(User);
        this.conversationRepository = AppDataSource.getRepository(Conversation);
    }

    async initiateCall(conversationId: number, callerId: number, calleeId: number, callType: CallType): Promise<Call> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
        });

        if (!conversation) {
            throw new Error('Conversation not found');
        }

        const isValid =
            (conversation.patient_id === callerId &&
                conversation.doctor_id === (await this.getDoctorIdFromUserId(calleeId))) ||
            (conversation.patient_id === calleeId &&
                conversation.doctor_id === (await this.getDoctorIdFromUserId(callerId)));

        if (!isValid) {
            throw new Error('Participants do not belong to this conversation');
        }

        const call = this.callRepository.create({
            conversation_id: conversationId,
            caller_id: callerId,
            callee_id: calleeId,
            call_type: callType,
            status: CallStatus.INITIATED,
        });

        return await this.callRepository.save(call);
    }

    private async getDoctorIdFromUserId(userId: number): Promise<number | undefined> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['doctor'],
        });
        return user?.doctor?.id;
    }

    async acceptCall(callId: number, userId: number): Promise<Call> {
        const call = await this.callRepository.findOne({ where: { id: callId } });
        if (!call) throw new Error('Call not found');

        if (call.callee_id !== userId) {
            throw new Error('Unauthorized to accept this call');
        }

        call.status = CallStatus.ACCEPTED;
        call.started_at = new Date();

        return await this.callRepository.save(call);
    }

    async rejectCall(callId: number, userId: number): Promise<Call> {
        const call = await this.callRepository.findOne({ where: { id: callId } });
        if (!call) throw new Error('Call not found');

        if (call.callee_id !== userId) {
            throw new Error('Unauthorized to reject this call');
        }

        call.status = CallStatus.REJECTED;
        return await this.callRepository.save(call);
    }

    async endCall(callId: number, userId: number): Promise<Call> {
        const call = await this.callRepository.findOne({ where: { id: callId } });
        if (!call) throw new Error('Call not found');

        if (call.caller_id !== userId && call.callee_id !== userId) {
            throw new Error('Unauthorized to end this call');
        }

        call.status = CallStatus.ENDED;
        call.ended_at = new Date();

        if (call.started_at) {
            const durationMs = call.ended_at.getTime() - call.started_at.getTime();
            call.duration = Math.floor(durationMs / 1000);
        } else {
            call.duration = 0;
        }

        return await this.callRepository.save(call);
    }

    async getCallHistory(
        userId: number,
        page: number = 1,
        limit: number = 20,
    ): Promise<{ calls: Call[]; total: number }> {
        const [calls, total] = await this.callRepository.findAndCount({
            where: [{ caller_id: userId }, { callee_id: userId }],
            relations: ['caller', 'callee'],
            order: { created_at: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { calls, total };
    }

    async getCallById(callId: number, userId: number): Promise<Call | null> {
        const call = await this.callRepository.findOne({
            where: { id: callId },
            relations: ['caller', 'callee'],
        });

        if (!call) return null;

        if (call.caller_id !== userId && call.callee_id !== userId) {
            throw new Error('Unauthorized access to call details');
        }

        return call;
    }

    async validateCallParticipant(callId: number, userId: number): Promise<boolean> {
        const call = await this.callRepository.findOne({ where: { id: callId } });
        if (!call) return false;
        return call.caller_id === userId || call.callee_id === userId;
    }
}
