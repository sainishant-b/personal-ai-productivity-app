import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { 
  LayoutDashboard, 
  Plus, 
  User, 
  Calendar, 
  BarChart3, 
  Settings, 
  LogOut,
  Square,
  Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import MobileBottomNav from "./MobileBottomNav";
import CheckInModal from "./CheckInModal";
import TaskDialog from "./TaskDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const checkInQuestions = [
    "What are you working on right now?",
    "How's your progress going?",
    "What's your energy level right now? (1-10)",
    "Feeling stuck on anything?",
    "What did you accomplish in the last hour?",
  ];

  // Hide bottom nav on auth page
  const showBottomNav = location.pathname !== "/auth";
  
  // Detect platform
  const isIOS = Capacitor.getPlatform() === "ios";
  const isAndroid = Capacitor.getPlatform() === "android";
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    // Configure status bar for iOS and Android
    const configureStatusBar = async () => {
      if (!isNative) return;
      
      try {
        if (isIOS) {
          // iOS status bar configuration
          await StatusBar.setStyle({ style: Style.Dark });
          // iOS doesn't support setBackgroundColor - it's controlled by the app's content
          await StatusBar.setOverlaysWebView({ overlay: true });
        } else if (isAndroid) {
          // Android status bar configuration
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: "#000000" });
          await StatusBar.setOverlaysWebView({ overlay: false });
        }
      } catch (error) {
        console.log("Status bar configuration not available:", error);
      }
    };

    // Handle back button (Android only - iOS uses swipe gestures)
    const setupBackButton = async () => {
      if (!isAndroid) return;
      
      try {
        await App.addListener("backButton", () => {
          // Check if on home/dashboard - exit app
          if (location.pathname === "/" || location.pathname === "/auth") {
            App.exitApp();
          } else {
            // Navigate back using React Router
            navigate(-1);
          }
        });
      } catch (error) {
        console.log("Back button handler not available:", error);
      }
    };

    configureStatusBar();
    setupBackButton();

    return () => {
      if (isNative) {
        App.removeAllListeners().catch(() => {});
      }
    };
  }, [location.pathname, navigate, isNative, isIOS, isAndroid]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setProfile(data);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleCheckInSubmit = async (response: string, mood?: string, energyLevel?: number) => {
    if (!user) return;
    
    const randomQuestion = checkInQuestions[Math.floor(Math.random() * checkInQuestions.length)];
    
    const { error } = await supabase.from("check_ins").insert([{
      user_id: user.id,
      question: randomQuestion,
      response,
      mood,
      energy_level: energyLevel,
    }]);

    if (!error && profile) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastCheckIn = profile.last_check_in_date ? new Date(profile.last_check_in_date) : null;
      if (lastCheckIn) lastCheckIn.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (!lastCheckIn || lastCheckIn.getTime() !== today.getTime()) {
        let newStreak = 1;
        
        if (lastCheckIn && lastCheckIn.getTime() === yesterday.getTime()) {
          newStreak = profile.current_streak + 1;
        }
        
        await supabase.from("profiles").update({
          current_streak: newStreak,
          longest_streak: Math.max(profile.longest_streak, newStreak),
          last_check_in_date: new Date().toISOString(),
        }).eq("id", user.id);
        
        fetchProfile();
      }
    }
  };

  // Listen for check-in events from other components
  useEffect(() => {
    const handleOpenCheckIn = () => {
      setShowCheckIn(true);
    };
    
    window.addEventListener("open-checkin", handleOpenCheckIn);
    return () => window.removeEventListener("open-checkin", handleOpenCheckIn);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const handleSaveTask = async (taskData: any) => {
    if (!user) return;
    
    const { error } = await supabase.from("tasks").insert([{
      ...taskData,
      user_id: user.id
    }]);
    
    if (error) {
      toast.error("Failed to create task");
    } else {
      toast.success("Task created!");
      // Dispatch event to refresh tasks in Dashboard
      window.dispatchEvent(new CustomEvent("tasks-updated"));
    }
    setShowTaskDialog(false);
  };

  return (
    <div 
      className="min-h-screen bg-background flex"
      style={{ 
        // iOS uses safe-area-inset for notch/Dynamic Island
        paddingTop: isIOS ? "env(safe-area-inset-top, 0px)" : "env(safe-area-inset-top, 0px)",
        paddingBottom: showBottomNav 
          ? "calc(60px + env(safe-area-inset-bottom, 0px))" 
          : "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      {/* Left Icon Sidebar - Desktop/Tablet */}
      {showBottomNav && user && (
        <TooltipProvider delayDuration={0}>
          <aside className="hidden md:flex flex-col items-center w-14 bg-zinc-900 border-r border-zinc-800 py-4 gap-1 shrink-0">
            {/* Top toggle icons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/")}
                  className={`h-10 w-10 text-zinc-400 hover:text-white hover:bg-zinc-800 ${
                    isActive("/") ? "text-white bg-zinc-800" : ""
                  }`}
                >
                  <Square className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Dashboard</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <Copy className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Duplicate</TooltipContent>
            </Tooltip>

            {/* Add Task Button - Orange accent */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  onClick={() => setShowTaskDialog(true)}
                  className="h-10 w-10 mt-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Add Task</TooltipContent>
            </Tooltip>

            {/* Navigation icons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCheckIn(true)}
                  className="h-10 w-10 mt-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <User className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Check-in</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/calendar")}
                  className={`h-10 w-10 text-zinc-400 hover:text-white hover:bg-zinc-800 ${
                    isActive("/calendar") ? "text-white bg-zinc-800" : ""
                  }`}
                >
                  <Calendar className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Calendar</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/insights")}
                  className={`h-10 w-10 text-zinc-400 hover:text-white hover:bg-zinc-800 ${
                    isActive("/insights") ? "text-white bg-zinc-800" : ""
                  }`}
                >
                  <BarChart3 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Insights</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/settings")}
                  className={`h-10 w-10 text-zinc-400 hover:text-white hover:bg-zinc-800 ${
                    isActive("/settings") ? "text-white bg-zinc-800" : ""
                  }`}
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>

            {/* Spacer to push logout to bottom */}
            <div className="flex-1" />

            {/* Logout at bottom */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="h-10 w-10 text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign Out</TooltipContent>
            </Tooltip>
          </aside>
        </TooltipProvider>
      )}

      {/* Main content area */}
      <main className="flex-1 min-w-0 flex flex-col">
        {children}
      </main>
      
      {showBottomNav && (
        <MobileBottomNav onCheckIn={() => setShowCheckIn(true)} />
      )}

      <CheckInModal
        open={showCheckIn}
        onClose={() => setShowCheckIn(false)}
        question={checkInQuestions[Math.floor(Math.random() * checkInQuestions.length)]}
        onSubmit={handleCheckInSubmit}
      />

      <TaskDialog
        open={showTaskDialog}
        onClose={() => setShowTaskDialog(false)}
        onSave={handleSaveTask}
      />
    </div>
  );
}
