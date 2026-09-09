'use client';

// Astryx Banner — Meta's Astryx design system (https://astryx.atmeta.com).
// Re-exported from the official @astryxdesign/core package. All styling ships
// via the sibling index.css (injected into the preview's global stylesheet);
// theme tokens come from the demo's <Theme> wrapper.
// Docs: https://astryx.atmeta.com/components/Banner

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import type { BannerProps, BannerStatus, BannerContainer } from '@astryxdesign/core/Banner';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

export { Banner } from '@astryxdesign/core/Banner';
export type { BannerProps, BannerStatus, BannerContainer } from '@astryxdesign/core/Banner';

/**
 * Drop-in Theme-wrapped Astryx Banner for effortless Alert & Notification usage
 * without needing manual <Theme> wrappers in every component.
 */
export interface AlertBannerProps extends BannerProps {
  id?: string;
  className?: string;
}

export function AlertBanner({ isDismissable = true, className = '', ...props }: AlertBannerProps) {
  return (
    <Theme theme={neutralTheme}>
      <div className={`astryx-banner-root transition-all duration-200 ${className}`}>
        <Banner {...props} isDismissable={isDismissable} />
      </div>
    </Theme>
  );
}

// ----------------------------------------------------------------------
// Notification & Alert Management System (Context + Hook)
// ----------------------------------------------------------------------

export interface AlertNotification {
  id: string;
  status: BannerStatus; // 'info' | 'warning' | 'error' | 'success'
  title: React.ReactNode;
  description?: React.ReactNode;
  isDismissable?: boolean;
  onDismiss?: () => void;
  duration?: number; // Auto-dismiss time in ms (0 or undefined = persistent)
  endContent?: React.ReactNode;
  timestamp?: number;
}

export type AlertInput = Omit<AlertNotification, 'id'> & { id?: string };

interface AlertContextValue {
  alerts: AlertItem[];
  showAlert: (alert: AlertInput) => string;
  dismissAlert: (id: string) => void;
  clearAlerts: () => void;
  notify: {
    success: (title: React.ReactNode, description?: React.ReactNode, options?: Partial<AlertInput>) => string;
    warning: (title: React.ReactNode, description?: React.ReactNode, options?: Partial<AlertInput>) => string;
    error: (title: React.ReactNode, description?: React.ReactNode, options?: Partial<AlertInput>) => string;
    info: (title: React.ReactNode, description?: React.ReactNode, options?: Partial<AlertInput>) => string;
  };
}

export type AlertItem = AlertNotification;

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const showAlert = useCallback((input: AlertInput): string => {
    const id = input.id || `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newAlert: AlertItem = {
      ...input,
      id,
      isDismissable: input.isDismissable !== false,
      timestamp: Date.now()
    };

    setAlerts(prev => [newAlert, ...prev.filter(a => a.id !== id)]);

    if (input.duration && input.duration > 0) {
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== id));
      }, input.duration);
    }

    return id;
  }, []);

  const notify = useMemo(() => ({
    success: (title: React.ReactNode, description?: React.ReactNode, options?: Partial<AlertInput>) =>
      showAlert({ status: 'success', title, description, ...options }),
    warning: (title: React.ReactNode, description?: React.ReactNode, options?: Partial<AlertInput>) =>
      showAlert({ status: 'warning', title, description, ...options }),
    error: (title: React.ReactNode, description?: React.ReactNode, options?: Partial<AlertInput>) =>
      showAlert({ status: 'error', title, description, ...options }),
    info: (title: React.ReactNode, description?: React.ReactNode, options?: Partial<AlertInput>) =>
      showAlert({ status: 'info', title, description, ...options })
  }), [showAlert]);

  return (
    <AlertContext.Provider value={{ alerts, showAlert, dismissAlert, clearAlerts, notify }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    // Safe fallback when used outside AlertProvider
    return {
      alerts: [],
      showAlert: () => '',
      dismissAlert: () => {},
      clearAlerts: () => {},
      notify: {
        success: () => '',
        warning: () => '',
        error: () => '',
        info: () => ''
      }
    };
  }
  return ctx;
}

/**
 * Floating or Inline Alert Notification Container
 * Automatically displays active alerts managed by useAlert().
 */
export function AlertBannerContainer({
  position = 'top-right',
  className = ''
}: {
  position?: 'top-right' | 'top-center' | 'bottom-right' | 'inline';
  className?: string;
}) {
  const { alerts, dismissAlert } = useAlert();

  if (!alerts || alerts.length === 0) return null;

  const positionStyles: Record<string, string> = {
    'top-right': 'fixed top-4 right-4 z-50 max-w-md w-full space-y-3 pointer-events-auto',
    'top-center': 'fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full space-y-3 pointer-events-auto',
    'bottom-right': 'fixed bottom-4 right-4 z-50 max-w-md w-full space-y-3 pointer-events-auto',
    'inline': 'w-full space-y-3'
  };

  return (
    <Theme theme={neutralTheme}>
      <div
        className={`${positionStyles[position] || positionStyles['top-right']} ${className}`}
        role="region"
        aria-label="System Alerts & Notifications"
      >
        {alerts.map(alert => (
          <div
            key={alert.id}
            className="transition-all duration-300 transform translate-y-0 opacity-100 shadow-lg rounded-xl overflow-hidden"
          >
            <Banner
              status={alert.status}
              title={alert.title}
              description={alert.description}
              isDismissable={alert.isDismissable}
              onDismiss={() => {
                dismissAlert(alert.id);
                alert.onDismiss?.();
              }}
              endContent={alert.endContent}
            />
          </div>
        ))}
      </div>
    </Theme>
  );
}

export default Banner;
