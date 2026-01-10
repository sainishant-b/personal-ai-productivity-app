import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  BellOff, 
  Clock, 
  Calendar, 
  Sparkles, 
  AlertTriangle,
  Moon,
  Timer,
  TestTube,
  RefreshCw,
} from "lucide-react";
import { useLocalNotifications } from "@/hooks/useLocalNotifications";
import { toast } from "sonner";

interface NotificationSettingsCardProps {
  onSettingsChange?: () => void;
}

export const NotificationSettingsCard = ({ onSettingsChange }: NotificationSettingsCardProps) => {
  const {
    isNative,
    isSupported,
    hasPermission,
    settings,
    pendingNotifications,
    requestPermission,
    scheduleNotification,
    cancelAllNotifications,
    updateSettings,
    refreshPendingNotifications,
  } = useLocalNotifications();

  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSettingChange = <K extends keyof typeof settings>(
    key: K,
    value: typeof settings[K]
  ) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    updateSettings({ [key]: value });
    onSettingsChange?.();
  };

  const handleTestNotification = async () => {
    if (!hasPermission) {
      toast.error("Please enable notifications first");
      return;
    }

    const testTime = new Date(Date.now() + 5000); // 5 seconds from now
    
    await scheduleNotification({
      title: "🔔 Test Notification",
      body: "Notifications are working! You'll receive reminders for check-ins and tasks.",
      scheduleAt: testTime,
      type: 'check-in',
      data: { type: 'test' },
    });

    toast.success("Test notification scheduled for 5 seconds from now");
  };

  const handleClearAll = async () => {
    await cancelAllNotifications();
    await refreshPendingNotifications();
    toast.success("All scheduled notifications cleared");
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            Notifications Not Supported
          </CardTitle>
          <CardDescription>
            Your device or browser doesn't support scheduled notifications.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Scheduled Notifications
          {hasPermission && (
            <Badge variant="secondary" className="ml-2">
              {pendingNotifications?.notifications?.length || 0} scheduled
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Configure reminders and alerts for tasks and check-ins
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Permission status */}
        {!hasPermission && (
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="font-medium">Enable Notifications</p>
              <p className="text-sm text-muted-foreground">
                Allow notifications to receive reminders
              </p>
            </div>
            <Button onClick={requestPermission}>
              Enable
            </Button>
          </div>
        )}

        {hasPermission && (
          <>
            {/* Notification Types */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Notification Types</h4>
              
              {/* Check-in Reminders */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="checkin-toggle" className="cursor-pointer">
                      Check-in Reminders
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Remind you to log energy and mood during work hours
                    </p>
                  </div>
                </div>
                <Switch
                  id="checkin-toggle"
                  checked={localSettings.checkInReminders}
                  onCheckedChange={(v) => handleSettingChange('checkInReminders', v)}
                />
              </div>

              {/* Task Reminders */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="task-toggle" className="cursor-pointer">
                      Task Due Reminders
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Get notified before tasks are due
                    </p>
                  </div>
                </div>
                <Switch
                  id="task-toggle"
                  checked={localSettings.taskReminders}
                  onCheckedChange={(v) => handleSettingChange('taskReminders', v)}
                />
              </div>

              {/* AI Recommendations */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="ai-toggle" className="cursor-pointer">
                      Daily AI Recommendations
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Daily notification with personalized task suggestions
                    </p>
                  </div>
                </div>
                <Switch
                  id="ai-toggle"
                  checked={localSettings.aiRecommendations}
                  onCheckedChange={(v) => handleSettingChange('aiRecommendations', v)}
                />
              </div>

              {/* Smart Task Reminders */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="smart-toggle" className="cursor-pointer">
                      Smart Task Reminders
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Get notified at AI-recommended times for tasks
                    </p>
                  </div>
                </div>
                <Switch
                  id="smart-toggle"
                  checked={localSettings.smartTaskReminders}
                  onCheckedChange={(v) => handleSettingChange('smartTaskReminders', v)}
                />
              </div>

              {/* Overdue Alerts */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="overdue-toggle" className="cursor-pointer">
                      Overdue Task Alerts
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Daily alert for overdue tasks at 9 AM
                    </p>
                  </div>
                </div>
                <Switch
                  id="overdue-toggle"
                  checked={localSettings.overdueAlerts}
                  onCheckedChange={(v) => handleSettingChange('overdueAlerts', v)}
                />
              </div>
            </div>

            {/* Reminder Lead Time */}
            <div className="space-y-2 border-t pt-4">
              <h4 className="text-sm font-medium">Reminder Timing</h4>
              <div className="flex items-center gap-4">
                <Label htmlFor="lead-time" className="min-w-fit">
                  Notify me
                </Label>
                <Select
                  value={localSettings.reminderLeadTime.toString()}
                  onValueChange={(v) => handleSettingChange('reminderLeadTime', parseInt(v))}
                >
                  <SelectTrigger id="lead-time" className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">before task time</span>
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Quiet Hours</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                No notifications will be sent during these hours
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="quiet-start" className="text-xs">From</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={localSettings.quietHoursStart}
                    onChange={(e) => handleSettingChange('quietHoursStart', e.target.value)}
                    className="w-[120px]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="quiet-end" className="text-xs">To</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={localSettings.quietHoursEnd}
                    onChange={(e) => handleSettingChange('quietHoursEnd', e.target.value)}
                    className="w-[120px]"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button onClick={handleTestNotification} variant="outline" size="sm">
                <TestTube className="h-4 w-4 mr-2" />
                Test Notification
              </Button>
              <Button onClick={refreshPendingNotifications} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button 
                onClick={handleClearAll} 
                variant="outline" 
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                Clear All Scheduled
              </Button>
            </div>

            {/* Pending notifications info */}
            {pendingNotifications && pendingNotifications.notifications.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2">
                  Scheduled Notifications ({pendingNotifications.notifications.length})
                </h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {pendingNotifications.notifications.slice(0, 5).map((n) => (
                    <div key={n.id} className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="truncate flex-1">{n.title}</span>
                      {n.schedule?.at && (
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded">
                          {new Date(n.schedule.at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  ))}
                  {pendingNotifications.notifications.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{pendingNotifications.notifications.length - 5} more...
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Platform info */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          {isNative 
            ? "📱 Running on native platform with local notification support"
            : "🌐 Running in browser with web notification fallback"
          }
        </div>
      </CardContent>
    </Card>
  );
};
