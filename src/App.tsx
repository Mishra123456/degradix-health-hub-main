import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import UploadPage from "./pages/UploadPage";
import HealthPage from "./pages/HealthPage";
import DegradationPage from "./pages/DegradationPage";
import ClusteringPage from "./pages/ClusteringPage";
import ReliabilityPage from "./pages/ReliabilityPage";
import InsightsPage from "./pages/InsightsPage";
import RULPage from "./pages/RULPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
          <Route path="/health" element={<ProtectedRoute><HealthPage /></ProtectedRoute>} />
          <Route path="/degradation" element={<ProtectedRoute><DegradationPage /></ProtectedRoute>} />
          <Route path="/clustering" element={<ProtectedRoute><ClusteringPage /></ProtectedRoute>} />
          <Route path="/reliability" element={<ProtectedRoute><ReliabilityPage /></ProtectedRoute>} />
          <Route path="/rul" element={<ProtectedRoute><RULPage /></ProtectedRoute>} />
          <Route path="/insights" element={<ProtectedRoute><InsightsPage /></ProtectedRoute>} />
          <Route path="/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
          <Route path="/contact" element={<ProtectedRoute><ContactPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
