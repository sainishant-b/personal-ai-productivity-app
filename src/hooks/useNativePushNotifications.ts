import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from "@capacitor/push-notifications";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface UseNativePushReturn {
  isNative: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isRegistered: boolean;
  pushToken: string | null;
  registerForPush: () => Promise<boolean>;
  unregisterFromPush: () => Promise<boolean>;
}

export const useNativePushNotifications = (): UseNativePushReturn => {
  const [isNative] = useState(() => Capacitor.isNativePlatform());
  const [isIOS] = useState(() => Capacitor.getPlatform() === "ios");
  const [isAndroid] = useState(() => Capacitor.getPlatform() === "android");
  const [isRegistered, setIsRegistered] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);

  // Get the appropriate token prefix based on platform
  const getTokenPrefix = useCallback(() => {
    return isIOS ? "apns:" : "fcm:";
  }, [isIOS]);

  useEffect(() => {
    if (!isNative) return;

    const setupListeners = async () => {
      // Listen for registration success
      await PushNotifications.addListener("registration", async (token: Token) => {
        const platform = isIOS ? "iOS (APNs)" : "Android (FCM)";
        console.log(`Push registration success on ${platform}, token:`, token.value);
        setPushToken(token.value);
        setIsRegistered(true);

        // Save token to database with platform-specific prefix
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const tokenPrefix = isIOS ? "apns:" : "fcm:";
            const endpoint = `${tokenPrefix}${token.value}`;
            
            const { error } = await supabase
              .from("push_subscriptions")
              .upsert({
                user_id: user.id,
                endpoint: endpoint,
                p256dh_key: `native-${isIOS ? "apns" : "fcm"}`,
                auth_key: `native-${isIOS ? "apns" : "fcm"}`,
              }, {
                onConflict: "user_id,endpoint",
              });

            if (error) {
              console.error("Error saving push token:", error);
            } else {
              console.log(`${platform} token saved to database`);
            }
          }
        } catch (error) {
          console.error("Error saving push token:", error);
        }
      });

      // Listen for registration errors
      await PushNotifications.addListener("registrationError", (error) => {
        console.error("Push registration error:", error);
        const platform = isIOS ? "iOS" : "Android";
        toast.error(`Failed to register for push notifications on ${platform}`);
      });

      // Listen for push notifications received while app is in foreground
      await PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
        console.log("Push notification received:", notification);
        
        // Show a toast since the notification won't show in foreground by default
        toast(notification.title || "Notification", {
          description: notification.body,
        });
      });

      // Listen for notification tap/action
      await PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
        console.log("Push notification action performed:", action);
        
        const data = action.notification.data;
        
        // Handle navigation based on notification type
        if (data?.type === "check-in") {
          window.dispatchEvent(new CustomEvent("open-checkin"));
        } else if (data?.type === "task-reminder" && data?.taskId) {
          window.location.href = `/task/${data.taskId}`;
        }
      });

      // Check if already registered
      const permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === "granted") {
        // Check if we have a token in the database
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const tokenPrefix = isIOS ? "apns:" : "fcm:";
            const { data: subs } = await supabase
              .from("push_subscriptions")
              .select("endpoint")
              .eq("user_id", user.id)
              .like("endpoint", `${tokenPrefix}%`);
            
            if (subs && subs.length > 0) {
              setIsRegistered(true);
              const token = subs[0].endpoint.replace(tokenPrefix, "");
              setPushToken(token);
            }
          }
        } catch (error) {
          console.error("Error checking existing registration:", error);
        }
      }
    };

    setupListeners();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [isNative, isIOS]);

  const registerForPush = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      console.log("Not running on native platform");
      return false;
    }

    try {
      // Request permission
      let permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === "prompt") {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== "granted") {
        const platform = isIOS ? "iOS" : "Android";
        toast.error(`Push notification permission denied on ${platform}`);
        return false;
      }

      // Register for push notifications
      await PushNotifications.register();
      toast.success("Push notifications enabled!");
      return true;
    } catch (error) {
      console.error("Error registering for push:", error);
      toast.error("Failed to enable push notifications");
      return false;
    }
  }, [isNative, isIOS]);

  const unregisterFromPush = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;

    try {
      // Remove from database
      const { data: { user } } = await supabase.auth.getUser();
      if (user && pushToken) {
        const tokenPrefix = isIOS ? "apns:" : "fcm:";
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", `${tokenPrefix}${pushToken}`);
      }

      setIsRegistered(false);
      setPushToken(null);
      toast.success("Push notifications disabled");
      return true;
    } catch (error) {
      console.error("Error unregistering from push:", error);
      toast.error("Failed to disable push notifications");
      return false;
    }
  }, [isNative, isIOS, pushToken]);

  return {
    isNative,
    isIOS,
    isAndroid,
    isRegistered,
    pushToken,
    registerForPush,
    unregisterFromPush,
  };
};
