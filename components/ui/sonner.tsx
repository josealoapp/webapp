"use client";

import { Toaster as SonnerToaster } from "sonner";

import { useThemeSetting } from "@/components/ThemeProvider";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

export function Toaster(props: ToasterProps) {
  const { theme } = useThemeSetting();

  return (
    <SonnerToaster
      theme={theme}
      position="top-center"
      duration={2000}
      richColors
      closeButton
      {...props}
    />
  );
}
