import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Cpu, LogIn, UserPlus, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (isRegister) {
                await register(username, email, password);
            } else {
                await login(username, password);
            }
            navigate("/");
        } catch (err: any) {
            setError(err.message || "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="mb-8 flex flex-col items-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg mb-4">
                        <Cpu className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">DEGRADIX</h1>
                    <p className="text-sm text-muted-foreground mt-1">Predictive Machine Health Monitoring</p>
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
                    <h2 className="text-xl font-semibold text-foreground mb-1">
                        {isRegister ? "Create Account" : "Welcome Back"}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">
                        {isRegister
                            ? "Sign up to start monitoring your machines"
                            : "Sign in to your account"}
                    </p>

                    {error && (
                        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                placeholder="Enter your username"
                            />
                        </div>

                        {/* Email (register only) */}
                        {isRegister && (
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                    placeholder="Enter your email"
                                />
                            </div>
                        )}

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                        >
                            {loading ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                            ) : isRegister ? (
                                <>
                                    <UserPlus className="h-4 w-4" />
                                    Create Account
                                </>
                            ) : (
                                <>
                                    <LogIn className="h-4 w-4" />
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>

                    {/* Toggle */}
                    <div className="mt-6 text-center text-sm text-muted-foreground">
                        {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                        <button
                            onClick={() => {
                                setIsRegister(!isRegister);
                                setError("");
                            }}
                            className="font-medium text-primary hover:underline"
                        >
                            {isRegister ? "Sign In" : "Sign Up"}
                        </button>
                    </div>
                </div>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                    © 2024 Degradix. Machine Health Monitoring System.
                </p>
            </div>
        </div>
    );
}
