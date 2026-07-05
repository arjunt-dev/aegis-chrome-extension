import { requireNativeView } from 'expo';
import * as React from 'react';

import { BrowserLauncherViewProps } from './BrowserLauncher.types';

const NativeView: React.ComponentType<BrowserLauncherViewProps> =
  requireNativeView('BrowserLauncher');

export default function BrowserLauncherView(props: BrowserLauncherViewProps) {
  return <NativeView {...props} />;
}
