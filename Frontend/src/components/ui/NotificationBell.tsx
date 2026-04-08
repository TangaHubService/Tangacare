import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Bell, Check, Trash2 } from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { parseLocalDate } from '../../lib/date';
import {
    getAlertActionTarget,
    getAlertReferenceText,
    getAlertSeverityLabel,
    getAlertSeverityTone,
    getAlertTypeLabel,
    getAlertSortWeight,
} from '../../lib/alertUi';
import { pharmacyService } from '../../services/pharmacy.service';
import type { Alert } from '../../types/pharmacy';
import { Drawer } from './Drawer';

interface Notification {
    id: number;
    title: string;
    message: string;
    is_read: boolean;
    type: string;
    created_at: string;
    data?: {
        order_id?: number;
        action?: string;
        alertId?: number;
    };
}

type FeedItem =
    | { kind: 'alert'; created_at: string; id: number; alert: Alert; sortTs: number }
    | {
          kind: 'notification';
          created_at: string;
          id: number;
          notification: Notification;
          sortTs: number;
      };

type AlertFeedItem = Extract<FeedItem, { kind: 'alert' }>;
type NotificationFeedItem = Extract<FeedItem, { kind: 'notification' }>;

type FeedSection = {
    key: string;
    title: string;
    description: string;
    items: FeedItem[];
};

export const NotificationBell: React.FC = () => {
    const { socket, isConnected } = useSocket();
    const { facilityId, can } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [alertCount, setAlertCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isAlertLoading, setIsAlertLoading] = useState(true);
    const [recentAlertIds, setRecentAlertIds] = useState<number[]>([]);
    const navigate = useNavigate();

    const canManageAlerts = can('alerts:write');

    const unreadNotifications = useMemo(
        () => notifications.filter((notification) => !notification.is_read),
        [notifications],
    );

    const criticalAlerts = useMemo(
        () =>
            alerts.filter(
                (alert) =>
                    (alert.status === 'active' || alert.status === 'acknowledged') &&
                    (alert.severity === 'critical' || alert.severity === 'out_of_stock'),
            ),
        [alerts],
    );

    const acknowledgedAlerts = useMemo(
        () => alerts.filter((alert) => alert.status === 'acknowledged'),
        [alerts],
    );

    const openAlerts = useMemo(
        () =>
            alerts.filter(
                (alert) =>
                    alert.status === 'active' &&
                    alert.severity !== 'critical' &&
                    alert.severity !== 'out_of_stock',
            ),
        [alerts],
    );

    const feedSections = useMemo<FeedSection[]>(() => {
        const criticalItems: AlertFeedItem[] = criticalAlerts.map((alert) => ({
            kind: 'alert',
            created_at: alert.created_at,
            id: alert.id,
            alert,
            sortTs: parseLocalDate(alert.created_at).getTime(),
        }));

        const acknowledgedItems: AlertFeedItem[] = acknowledgedAlerts.map((alert) => ({
            kind: 'alert',
            created_at: alert.created_at,
            id: alert.id,
            alert,
            sortTs: parseLocalDate(alert.created_at).getTime(),
        }));

        const openAlertItems: AlertFeedItem[] = openAlerts.map((alert) => ({
            kind: 'alert',
            created_at: alert.created_at,
            id: alert.id,
            alert,
            sortTs: parseLocalDate(alert.created_at).getTime(),
        }));

        const notificationItems: NotificationFeedItem[] = unreadNotifications.map((notification) => ({
            kind: 'notification',
            created_at: notification.created_at,
            id: notification.id,
            notification,
            sortTs: parseLocalDate(notification.created_at).getTime(),
        }));

        return [
            {
                key: 'critical',
                title: 'Critical Alerts',
                description: 'Immediate stock or safety issues that should be checked first.',
                items: criticalItems.sort(
                    (a, b) =>
                        getAlertSortWeight(a.alert) - getAlertSortWeight(b.alert) ||
                        b.sortTs - a.sortTs,
                ),
            },
            {
                key: 'acknowledged',
                title: 'Owned Alerts',
                description: 'Alerts already acknowledged but still open and not yet resolved.',
                items: acknowledgedItems.sort(
                    (a, b) =>
                        getAlertSortWeight(a.alert) - getAlertSortWeight(b.alert) ||
                        b.sortTs - a.sortTs,
                ),
            },
            {
                key: 'open',
                title: 'Open Alerts',
                description: 'Warnings and informational alerts that still need follow-up.',
                items: openAlertItems.sort(
                    (a, b) =>
                        getAlertSortWeight(a.alert) - getAlertSortWeight(b.alert) ||
                        b.sortTs - a.sortTs,
                ),
            },
            {
                key: 'notifications',
                title: 'Unread Notifications',
                description: 'Recent unread system messages and workflow updates.',
                items: notificationItems.sort((a, b) => b.sortTs - a.sortTs),
            },
        ].filter((section) => section.items.length > 0);
    }, [acknowledgedAlerts, criticalAlerts, openAlerts, unreadNotifications]);

    const fetchOpenAlerts = async () => {
        if (!facilityId) return;
        setIsAlertLoading(true);
        try {
            const [activeResponse, acknowledgedResponse] = await Promise.all([
                pharmacyService.getAlerts({
                    facility_id: facilityId,
                    status: 'active',
                    limit: 8,
                }),
                pharmacyService.getAlerts({
                    facility_id: facilityId,
                    status: 'acknowledged',
                    limit: 6,
                }),
            ]);

            const merged = [...activeResponse.data, ...acknowledgedResponse.data].sort(
                (a, b) =>
                    getAlertSortWeight(a) - getAlertSortWeight(b) ||
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
            );

            setAlerts(merged);
            setAlertCount(
                (activeResponse.meta?.total ?? activeResponse.data.length) +
                    (acknowledgedResponse.meta?.total ?? acknowledgedResponse.data.length),
            );
        } catch (error) {
            console.error('Failed to fetch active alerts:', error);
        } finally {
            setIsAlertLoading(false);
        }
    };

    const openAlertCenter = (alert: Alert) => {
        setIsOpen(false);
        navigate({
            to: '/app/alerts' as any,
            search: {
                status: alert.status === 'acknowledged' ? 'acknowledged' : 'active',
                alertId: String(alert.id),
                type: alert.type,
            } as any,
        });
    };

    const openAlertAction = (alert: Alert) => {
        const actionTarget = getAlertActionTarget(alert);
        if (!actionTarget) {
            openAlertCenter(alert);
            return;
        }

        setIsOpen(false);
        navigate({
            to: actionTarget.to as any,
            search: (actionTarget.search || {}) as any,
        });
    };

    const handleNotificationClick = async (notification: Notification) => {
        try {
            if (!notification.is_read) {
                markAsRead(notification.id);
            }

            if (notification.data?.alertId) {
                setIsOpen(false);
                navigate({
                    to: '/app/alerts' as any,
                    search: { status: 'active', alertId: String(notification.data.alertId) } as any,
                });
                return;
            }

            if (notification.data?.order_id) {
                setIsOpen(false);
                navigate({
                    to: '/app/procurement/orders/$orderId' as any,
                    params: { orderId: String(notification.data.order_id) } as any,
                    search: {} as any,
                });
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const handleAcknowledgeAlert = async (alertId: number) => {
        try {
            await pharmacyService.acknowledgeAlert(alertId);
            await fetchOpenAlerts();
        } catch (error) {
            console.error('Failed to acknowledge alert:', error);
        }
    };

    useEffect(() => {
        if (socket && isConnected) {
            socket.emit('notification:sync');
        }
        void fetchOpenAlerts();
    }, [socket, isConnected, facilityId]);

    useEffect(() => {
        if (!isOpen) return;
        void fetchOpenAlerts();
    }, [isOpen, facilityId]);

    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (newNotification: Notification) => {
            setNotifications((prev) => [newNotification, ...prev]);
            setUnreadCount((prev) => prev + 1);
            void fetchOpenAlerts();
        };

        const handleSync = (data: { notifications: Notification[]; unreadCount: number }) => {
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
            setIsLoading(false);
        };

        const handleReadSuccess = ({ notificationId }: { notificationId: number }) => {
            setNotifications((prev) =>
                prev.map((notification) =>
                    notification.id === notificationId
                        ? { ...notification, is_read: true }
                        : notification,
                ),
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        };

        const handleReadAllSuccess = () => {
            setNotifications((prev) =>
                prev.map((notification) => ({ ...notification, is_read: true })),
            );
            setUnreadCount(0);
        };

        const handleAlertRefresh = () => {
            void fetchOpenAlerts();
        };

        const handleNewAlert = (payload: { id?: number } | number) => {
            void fetchOpenAlerts();
            const id = typeof payload === 'number' ? payload : payload?.id;
            if (!id) return;
            setRecentAlertIds((prev) => Array.from(new Set([id, ...prev])).slice(0, 8));
            window.setTimeout(() => {
                setRecentAlertIds((prev) => prev.filter((alertId) => alertId !== id));
            }, 8000);
        };

        socket.on('notification:new', handleNewNotification);
        socket.on('notification:sync', handleSync);
        socket.on('notification:read_success', handleReadSuccess);
        socket.on('notification:read_all_success', handleReadAllSuccess);
        socket.on('alert:new', handleNewAlert);
        socket.on('alert:updated', handleAlertRefresh);
        socket.on('alert:resolved', handleAlertRefresh);

        return () => {
            socket.off('notification:new', handleNewNotification);
            socket.off('notification:sync', handleSync);
            socket.off('notification:read_success', handleReadSuccess);
            socket.off('notification:read_all_success', handleReadAllSuccess);
            socket.off('alert:new', handleNewAlert);
            socket.off('alert:updated', handleAlertRefresh);
            socket.off('alert:resolved', handleAlertRefresh);
        };
    }, [socket, facilityId]);

    const markAsRead = (id: number) => {
        if (socket) {
            socket.emit('notification:read', { notificationId: id });
        }
    };

    const markAllRead = () => {
        if (socket) {
            socket.emit('notification:read_all');
        }
    };

    const deleteNotification = (id: number) => {
        setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors relative"
            >
                <Bell size={18} />
                {unreadCount + alertCount > 0 && (
                    <span
                        className={clsx(
                            'absolute top-0 right-0 w-4 h-4 text-[10px] font-bold flex items-center justify-center text-white rounded-full border border-white dark:border-slate-900 shadow-sm z-10',
                            alertCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500',
                        )}
                    >
                        {unreadCount + alertCount > 9 ? '9+' : unreadCount + alertCount}
                    </span>
                )}
            </button>

            <Drawer
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                size="md"
                title="Operational Inbox"
                subtitle={`${criticalAlerts.length} critical, ${alerts.length} open alerts, ${unreadCount} unread notifications`}
                showOverlay
                closeOnOverlayClick
                headerActions={
                    unreadCount > 0 ? (
                        <button
                            onClick={() => markAllRead()}
                            className="text-xs text-healthcare-primary hover:underline font-medium"
                        >
                            Mark all read
                        </button>
                    ) : undefined
                }
            >
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {isLoading || isAlertLoading ? (
                        <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
                    ) : feedSections.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                            <Bell size={24} className="text-slate-200" />
                            No open alerts or unread notifications
                        </div>
                    ) : (
                        <div className="space-y-5 p-3">
                            {feedSections.map((section) => (
                                <section key={section.key} className="space-y-2">
                                    <div className="px-1">
                                        <div className="flex items-center justify-between gap-3">
                                            <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                                                {section.title}
                                            </h4>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                {section.items.length} item{section.items.length === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-slate-500">{section.description}</p>
                                    </div>

                                    <div className="space-y-2">
                                        {section.items.map((item, index) => {
                                            const rowTime = formatDistanceToNow(
                                                parseLocalDate(item.created_at),
                                                {
                                                    addSuffix: true,
                                                },
                                            );

                                            if (item.kind === 'notification') {
                                                return (
                                                    <div
                                                        key={`${item.kind}-${item.id}`}
                                                        onClick={() => {
                                                            void handleNotificationClick(item.notification);
                                                        }}
                                                        className="rounded-2xl border border-slate-200 bg-white p-3 hover:border-healthcare-primary/30 hover:bg-slate-50 transition-all cursor-pointer dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/60"
                                                        style={{
                                                            animationDelay: `${Math.min(index * 35, 240)}ms`,
                                                        }}
                                                    >
                                                        <div className="flex gap-3">
                                                            <div className="mt-0.5 w-9 h-9 rounded-xl bg-teal-50 text-healthcare-primary flex items-center justify-center dark:bg-teal-950/20">
                                                                <Bell size={16} />
                                                            </div>
                                                            <div className="flex-1 min-w-0 space-y-2">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <p className="text-sm font-semibold text-healthcare-dark dark:text-white">
                                                                        {item.notification.title}
                                                                    </p>
                                                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                                        {rowTime}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                                    {item.notification.message}
                                                                </p>
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                                        Unread notification
                                                                    </span>
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                markAsRead(item.notification.id);
                                                                            }}
                                                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-teal-600"
                                                                            title="Mark as read"
                                                                        >
                                                                            <Check size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                deleteNotification(item.notification.id);
                                                                            }}
                                                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-red-400 hover:text-red-500"
                                                                            title="Delete"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            const alert = item.alert;
                                            const actionTarget = getAlertActionTarget(alert);
                                            const referenceText = getAlertReferenceText(alert);

                                            return (
                                                <div
                                                    key={`${item.kind}-${item.id}`}
                                                    onClick={() => openAlertCenter(alert)}
                                                    className={clsx(
                                                        'rounded-2xl border bg-white p-3 transition-all cursor-pointer dark:bg-slate-900',
                                                        recentAlertIds.includes(alert.id) &&
                                                            'ring-2 ring-healthcare-primary/40',
                                                        alert.status === 'acknowledged'
                                                            ? 'border-amber-200 hover:border-amber-300 dark:border-amber-900/30'
                                                            : 'border-slate-200 hover:border-healthcare-primary/30 dark:border-slate-800',
                                                    )}
                                                    style={{
                                                        animationDelay: `${Math.min(index * 35, 240)}ms`,
                                                    }}
                                                >
                                                    <div className="flex gap-3">
                                                        <div
                                                            className={clsx(
                                                                'mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center',
                                                                alert.severity === 'critical' ||
                                                                    alert.severity === 'out_of_stock'
                                                                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-300'
                                                                    : alert.severity === 'warning'
                                                                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-300'
                                                                        : 'bg-sky-50 text-sky-600 dark:bg-sky-950/20 dark:text-sky-300',
                                                            )}
                                                        >
                                                            <AlertTriangle size={16} />
                                                        </div>

                                                        <div className="flex-1 min-w-0 space-y-2">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="space-y-1 min-w-0">
                                                                    <p className="text-sm font-semibold text-healthcare-dark dark:text-white">
                                                                        {alert.title || getAlertTypeLabel(alert.type)}
                                                                    </p>
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span
                                                                            className={clsx(
                                                                                'px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider',
                                                                                getAlertSeverityTone(alert.severity),
                                                                            )}
                                                                        >
                                                                            {getAlertSeverityLabel(alert.severity)}
                                                                        </span>
                                                                        <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                            {getAlertTypeLabel(alert.type)}
                                                                        </span>
                                                                        {alert.status === 'acknowledged' && (
                                                                            <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/40">
                                                                                Owned
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                                    {rowTime}
                                                                </span>
                                                            </div>

                                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                                {alert.message}
                                                            </p>

                                                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                                                                {referenceText && <span>{referenceText}</span>}
                                                                {alert.status === 'acknowledged' && !referenceText && (
                                                                    <span>Acknowledged and waiting for closure</span>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                                                {actionTarget && (
                                                                    <button
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            openAlertAction(alert);
                                                                        }}
                                                                        className="px-3 py-2 rounded-xl bg-healthcare-primary text-white text-[11px] font-black uppercase tracking-wider hover:bg-healthcare-primary/90 transition-colors flex items-center gap-1.5"
                                                                    >
                                                                        {actionTarget.label}
                                                                        <ArrowRight size={12} />
                                                                    </button>
                                                                )}

                                                                {alert.status === 'active' && canManageAlerts && (
                                                                    <button
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            void handleAcknowledgeAlert(alert.id);
                                                                        }}
                                                                        className="px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-[11px] font-black uppercase tracking-wider hover:bg-amber-100 transition-colors"
                                                                    >
                                                                        Acknowledge
                                                                    </button>
                                                                )}

                                                                <button
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        openAlertCenter(alert);
                                                                    }}
                                                                    className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-wider hover:bg-slate-200 transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                                >
                                                                    Open Alert
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                        Alerts: {alerts.length} open | Notifications: {unreadCount} unread
                    </span>
                    <Link
                        to={'/app/alerts' as any}
                        search={{ status: 'active' } as any}
                        onClick={() => setIsOpen(false)}
                        className="text-[11px] font-bold text-healthcare-primary hover:underline flex items-center gap-1"
                    >
                        Open alert center <ArrowRight size={12} />
                    </Link>
                </div>
            </Drawer>
        </div>
    );
};
