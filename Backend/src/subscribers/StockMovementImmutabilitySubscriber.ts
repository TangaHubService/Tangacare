import { EntitySubscriberInterface, EventSubscriber, UpdateEvent, RemoveEvent } from 'typeorm';
import { StockMovement } from '../entities/StockMovement.entity';
import { AppError } from '../middleware/error.middleware';

/**
 * Ledger policy: stock movements are append-only. Corrections go through
 * adjustment flows that insert new movement rows — never mutate history.
 */
@EventSubscriber()
export class StockMovementImmutabilitySubscriber implements EntitySubscriberInterface<StockMovement> {
    listenTo() {
        return StockMovement;
    }

    beforeUpdate(_event: UpdateEvent<StockMovement>): void {
        throw new AppError('Stock movements are immutable and cannot be updated', 409);
    }

    beforeRemove(_event: RemoveEvent<StockMovement>): void {
        throw new AppError('Stock movements cannot be deleted', 409);
    }
}
