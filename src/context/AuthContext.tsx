import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

type UserInfo = {
    id: number;
    username: string;
    email: string;
};

type AuthContextType = {
    token: string | null;
    user: UserInfo | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(
        () => localStorage.getItem("degradix_token")
    );
    const [user, setUser] = useState<UserInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load user on mount if token exists
    useEffect(() => {
        if (token) {
            api
                .getMe(token)
                .then(setUser)
                .catch(() => {
                    // Token expired or invalid
                    localStorage.removeItem("degradix_token");
                    setToken(null);
                    setUser(null);
                })
                .finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, [token]);

    const login = useCallback(async (username: string, password: string) => {
        const data = await api.login(username, password);
        localStorage.setItem("degradix_token", data.access_token);
        setToken(data.access_token);
        setUser(data.user);
    }, []);

    const register = useCallback(async (username: string, email: string, password: string) => {
        const data = await api.register(username, email, password);
        localStorage.setItem("degradix_token", data.access_token);
        setToken(data.access_token);
        setUser(data.user);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem("degradix_token");
        setToken(null);
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                token,
                user,
                isAuthenticated: !!token && !!user,
                isLoading,
                login,
                register,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}
