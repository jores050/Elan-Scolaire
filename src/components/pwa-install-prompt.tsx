"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => isStandaloneMode());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "default";
    return Notification.permission;
  });
  const [isInstalling, setIsInstalling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        setStatusMessage("Le mode application n'a pas pu être préparé sur ce navigateur.");
      });
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setStatusMessage(null);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setStatusMessage("Application installée sur cet appareil.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const canAskNotifications = useMemo(
    () => typeof window !== "undefined" && "Notification" in window && notificationPermission === "default",
    [notificationPermission],
  );

  async function requestNotifications() {
    if (!("Notification" in window)) {
      setStatusMessage("Les notifications ne sont pas disponibles sur ce navigateur.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setStatusMessage(
      permission === "granted"
        ? "Notifications activées pour ÉLAN."
        : permission === "denied"
          ? "Notifications refusées dans le navigateur."
          : "Autorisation des notifications non encore confirmée.",
    );
  }

  async function installApp() {
    if (!deferredPrompt) {
      setStatusMessage("L'installation n'est pas disponible pour ce navigateur. Ouvrez le menu du navigateur puis choisissez Ajouter à l'écran d'accueil.");
      return;
    }

    setIsInstalling(true);
    setStatusMessage(null);
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstalling(false);

    if (choice.outcome === "accepted") {
      setIsStandalone(true);
      setStatusMessage("ÉLAN est maintenant installé sur votre appareil.");
      if (canAskNotifications) {
        await requestNotifications();
      }
      return;
    }

    setStatusMessage("Installation annulée. Vous pourrez réessayer plus tard.");
  }

  const shouldShowInstallButton = !isStandalone;
  const shouldShowNotificationButton = isStandalone && canAskNotifications;

  if (!shouldShowInstallButton && !shouldShowNotificationButton && !statusMessage) {
    return null;
  }

  return (
    <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Mode application</p>
          <p className="mt-1 font-semibold text-slate-950">
            {isStandalone ? "ÉLAN est installé sur cet appareil." : "Installez ÉLAN sur l'écran d'accueil pour l'ouvrir comme une application."}
          </p>
          <p className="mt-1 text-slate-600">
            {notificationPermission === "granted"
              ? "Les notifications sont déjà autorisées."
              : "Activez aussi les notifications pour recevoir les rappels importants."}
          </p>
          {statusMessage ? <p className="mt-2 text-xs font-semibold text-emerald-800">{statusMessage}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          {shouldShowInstallButton ? (
            <button type="button" className="btn-primary" onClick={installApp} disabled={isInstalling}>
              {isInstalling ? "Installation..." : "Installer l'app"}
            </button>
          ) : null}
          {shouldShowNotificationButton ? (
            <button type="button" className="btn-secondary" onClick={requestNotifications}>
              Autoriser les notifications
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
