import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { Link } from '@tanstack/react-router';
import { pharmacyService } from '../../services/pharmacy.service';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from '@tanstack/react-router';
import { parseLocalDate } from '../../lib/date';
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

export const NotificationBell: React.FC = () => {
    const { socket, isConnected } = useSocket();
    const { facilityId } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [alertCount, setAlertCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isAlertLoading, setIsAlertLoading] = useState(true);
    const [recentAlertIds, setRecentAlertIds] = useState<number[]>([]);
    const navigate = useNavigate();
    const unreadNotifications = notifications.filter((n) => !n.is_read);
    const unresolvedAlerts = alerts.filter((a) => a.status === 'active');
    const feedItems: FeedItem[] = [
        ...unreadNotifications.map((n) => ({
            kind: 'notification' as const,
            created_at: n.created_at,
            id: n.id,
            notification: n,
            sortTs: parseLocalDate(n.created_at).getTime(),
        })),
        ...unresolvedAlerts.map((a) => ({
            kind: 'alert' as const,
            created_at: a.created_at,
            id: a.id,
            alert: a,
            sortTs: parseLocalDate(a.created_at).getTime(),
        })),
    ].sort((a, b) => b.sortTs - a.sortTs);

    const handleNotificationClick = async (notification: Notification) => {
        try {
            if (!notification.is_read) {
                markAsRead(notification.id); // Use the existing markAsRead function
            }

            // Navigate based on notification data
            if (notification.data && notification.data.order_id) {
                setIsOpen(false); // Close popover
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

    const fetchActiveAlerts = async () => {
        if (!facilityId) return;
        setIsAlertLoading(true);
        try {
            const response = await pharmacyService.getAlerts({
                facility_id: facilityId,
                status: 'active',
                limit: 5,
            });
            setAlerts(response.data);
            setAlertCount(response.meta?.total ?? response.data.length);
        } catch (error) {
            console.error('Failed to fetch active alerts:', error);
        } finally {
            setIsAlertLoading(false);
        }
    };

    const handleAlertClick = (alertId: number) => {
        setIsOpen(false);
        navigate({
            to: '/app/alerts' as any,
            search: { status: 'active', alertId: String(alertId) } as any,
        });
    };

    // Initial sync
    useEffect(() => {
        if (socket && isConnected) {
            socket.emit('notification:sync');
        }
        fetchActiveAlerts();
    }, [socket, isConnected, facilityId]);

    useEffect(() => {
        if (!isOpen) return;
        fetchActiveAlerts();
    }, [isOpen, facilityId]);

    // Real-time listeners
    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (newNotification: Notification) => {
            setNotifications((prev) => [newNotification, ...prev]);
            setUnreadCount((prev) => prev + 1);
            fetchActiveAlerts();
        };

        const handleSync = (data: { notifications: Notification[]; unreadCount: number }) => {
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
            setIsLoading(false);
        };

        const handleReadSuccess = ({ notificationId }: { notificationId: number }) => {
            setNotifications((prev) =>
                prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        };

        const handleReadAllSuccess = () => {
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);
        };

        const handleAlertRefresh = () => {
            fetchActiveAlerts();
        };

        const handleNewAlert = (payload: { id?: number } | number) => {
            fetchActiveAlerts();
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
        setNotifications((prev) => prev.filter((n) => n.id !== id));
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
                title="Live Activity"
                subtitle={`${feedItems.length} unresolved items`}
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
                    ) : feedItems.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                            <Bell size={24} className="text-slate-200" />
                            No unresolved alerts or unread notifications
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {feedItems.map((item, index) => {
                                const isAlert = item.kind === 'alert';
                                const rowTime = formatDistanceToNow(parseLocalDate(item.created_at), {
                                    addSuffix: true,
                                });
                                const title = isAlert
                                    ? item.alert.title || 'Alert'
                                    : item.notification.title;
                                const message = isAlert
                                    ? item.alert.message
                                    : item.notification.message;
                                const highlight = isAlert
                                    ? clsx(
                                          'bg-red-50/50 dark:bg-red-900/20',
                                          recentAlertIds.includes(item.alert.id) && 'animate-pulse',
                                      )
                                    : 'bg-teal-50/40 dark:bg-teal-900/10';

                                return (
                                    <div
                                        key={`${item.kind}-${item.id}`}
                                        onClick={() => {
                                            if (isAlert) {
                                                handleAlertClick(item.alert.id);
                                            } else {
                                                handleNotificationClick(item.notification);
                                            }
                                        }}
                                        className={clsx(
                                            'p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 flex gap-3 text-left group cursor-pointer animate-in fade-in slide-in-from-right-1',
                                            highlight,
                                        )}
                                        style={{ animationDelay: `${Math.min(index * 35, 240)}ms` }}
                                    >
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-start justify-between">
                                                <p
                                                    className={clsx(
                                                        'text-sm font-medium text-healthcare-dark flex items-center gap-1.5',
                                                        isAlert
                                                            ? 'text-red-600 dark:text-red-400'
                                                            : 'text-healthcare-primary',
                                                    )}
                                                >
                                                    {isAlert ? (
                                                        <AlertTriangle size={13} />
                                                    ) : (
                                                        <Bell size={13} />
                                                    )}
                                                    {title}
                                                </p>
                                                <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                                    {rowTime}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                {message}
                                            </p>
                                            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                {isAlert
                                                    ? 'Alert (Unresolved)'
                                                    : 'Notification (Unread)'}
                                            </div>
                                        </div>
                                        {!isAlert && (
                                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsRead(item.notification.id);
                                                    }}
                                                    className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-teal-600"
                                                    title="Mark as read"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteNotification(item.notification.id);
                                                    }}
                                                    className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-red-400 hover:text-red-500"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                        Alerts: {alertCount} | Unread: {unreadCount}
                    </span>
                    <Link
                        to={'/app/alerts' as any}
                        search={{ status: 'active' } as any}
                        onClick={() => setIsOpen(false)}
                        className="text-[11px] font-bold text-healthcare-primary hover:underline flex items-center gap-1"
                    >
                        Open alerts <ArrowRight size={12} />
                    </Link>
                </div>
            </Drawer>
        </div>
    );
};
