import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('access_token');

        if (user && token) {
            const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
            const socketUrl = apiUrl.startsWith('http') ? new URL(apiUrl).origin : apiUrl;

            const socketInstance = io(socketUrl, {
                auth: {
                    token: token,
                },
                transports: ['websocket'],
            });

            socketInstance.on('connect', () => {
                console.log('Socket connected:', socketInstance.id);
                setIsConnected(true);
            });

            socketInstance.on('disconnect', () => {
                console.log('Socket disconnected');
                setIsConnected(false);
            });

            socketInstance.on('connect_error', (err) => {
                console.error('Socket connection error:', err);
            });

            setSocket(socketInstance);

            return () => {
                socketInstance.disconnect();
            };
        } else {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setIsConnected(false);
            }
        }
    }, [user]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>
    );
};
