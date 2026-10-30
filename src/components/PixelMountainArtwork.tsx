import React from 'react';

/**
 * Crisp SVG recreation of the VION pixel mountain peak with blue flag
 * shown in the desktop reference screenshot (1_101dd8d5.PNG).
 * Avoids using any UI screenshot as a background image while preserving
 * the exact visual identity on desktop.
 */
export function PixelMountainArtwork({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Subtle dark backdrop frame */}
      <rect x="8" y="20" width="144" height="60" fill="#131622" />

      {/* Background distant ridges */}
      <rect x="16" y="44" width="16" height="36" fill="#1A1E2D" />
      <rect x="24" y="38" width="16" height="42" fill="#1A1E2D" />
      <rect x="120" y="42" width="16" height="38" fill="#1A1E2D" />
      <rect x="128" y="36" width="16" height="44" fill="#1A1E2D" />

      {/* Main mountain body (slate blue) */}
      <rect x="20" y="72" width="120" height="8" fill="#2A384F" />
      <rect x="32" y="64" width="96" height="8" fill="#2A384F" />
      <rect x="44" y="56" width="76" height="8" fill="#2A384F" />
      <rect x="52" y="48" width="60" height="8" fill="#2A384F" />
      <rect x="60" y="40" width="44" height="8" fill="#2A384F" />
      <rect x="68" y="32" width="28" height="8" fill="#364863" />

      {/* Snow / Highlighted left slope steps */}
      <rect x="76" y="24" width="12" height="8" fill="#FFFFFF" />
      <rect x="68" y="32" width="16" height="8" fill="#D5DFEE" />
      <rect x="60" y="40" width="16" height="8" fill="#9EB0CA" />
      <rect x="52" y="48" width="16" height="8" fill="#6F84A3" />
      <rect x="40" y="56" width="16" height="8" fill="#526785" />
      <rect x="28" y="64" width="16" height="8" fill="#425570" />
      <rect x="16" y="72" width="16" height="8" fill="#384963" />

      {/* Right slope pixel steps */}
      <rect x="88" y="32" width="8" height="8" fill="#5D7496" />
      <rect x="96" y="40" width="8" height="8" fill="#4C6282" />
      <rect x="104" y="48" width="12" height="8" fill="#3E526E" />
      <rect x="116" y="56" width="12" height="8" fill="#34465F" />
      <rect x="128" y="64" width="12" height="8" fill="#2A384F" />

      {/* Flagpole at summit */}
      <rect x="80" y="8" width="3" height="16" fill="#FFFFFF" />

      {/* VION Blue Flag */}
      <rect x="83" y="8" width="16" height="10" fill="#2563EB" />
      <rect x="86" y="11" width="3" height="3" fill="#93C5FD" />
      <rect x="92" y="11" width="3" height="3" fill="#93C5FD" />
    </svg>
  );
}
