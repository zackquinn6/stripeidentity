import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Projects from "./pages/Projects";
import Auth from "./pages/Auth";
import Test from "./pages/Test";
import NotFound from "./pages/NotFound";
import AdminButton from "@/components/admin/AdminButton";
import PoweredByFooter from "@/components/PoweredByFooter";
import { useBooqable } from "@/hooks/use-booqable";

const queryClient = new QueryClient();

const AppContent = () => {
  useBooqable();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/test" element={<Test />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <AdminButton />
      <PoweredByFooter />
    </div>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
