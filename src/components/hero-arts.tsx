import React from "react";

/**
 * 1. HeroLatestArt - NeuBench Quantum Transmission Core (Electric Violet / Neon Cyan)
 * Simple, iconic, futuristic, and uncluttered.
 */
export function HeroLatestArt() {
  return (
    <div aria-hidden="true" className="hero-art hero-logo-showcase hero-latest-art">
      <svg
        aria-label="NeuBench transmission beacon"
        className="hero-animated-svg hero-latest-svg"
        fill="none"
        viewBox="0 0 200 200"
      >
        <defs>
          <radialGradient id="latestOuterNebula" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.38" />
            <stop offset="50%" stopColor="#6366F1" stopOpacity="0.12" />
            <stop offset="85%" stopColor="#22D3EE" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="latestDiamondGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E1B4B" />
            <stop offset="50%" stopColor="#151226" />
            <stop offset="100%" stopColor="#0B0914" />
          </linearGradient>
          <linearGradient id="latestBeamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C084FC" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
          <filter id="latestGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="latestCoreGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Soft Ambient Nebula Glow */}
        <circle cx="100" cy="100" fill="url(#latestOuterNebula)" r="92">
        </circle>

        {/* Minimal Precision Crosshairs */}
        <g stroke="#8B5CF6" strokeWidth="1.4" strokeLinecap="round" opacity="0.45">
          <line x1="100" y1="12" x2="100" y2="22" />
          <line x1="100" y1="178" x2="100" y2="188" />
          <line x1="12" y1="100" x2="22" y2="100" />
          <line x1="178" y1="100" x2="188" y2="100" />
        </g>

        {/* Rhythmic Broadcast Radar Waves (Broadcasting Outward) */}
        <circle cx="100" cy="100" fill="none" stroke="#C084FC" strokeWidth="1.4">
        </circle>
        <circle cx="100" cy="100" fill="none" stroke="#22D3EE" strokeWidth="1.4">
        </circle>

        {/* Single Sleek Telemetry Orbit Track */}
        <circle
          cx="100"
          cy="100"
          r="80"
          stroke="#8B5CF6"
          strokeOpacity="0.28"
          strokeWidth="1.2"
          strokeDasharray="4 8 24 8"
          fill="none"
        >
        </circle>

        {/* Single Glowing Quantum Photon Satellite (Smooth Glide) */}
        <g>
          {/* Subtle Photon Tail */}
          <path
            d="M 180 100 A 80 80 0 0 0 168 56"
            stroke="url(#latestBeamGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
          {/* Cyan Photon Beacon */}
          <circle cx="180" cy="100" r="7" fill="none" stroke="#22D3EE" strokeWidth="0.8" opacity="0.4" />
          <circle cx="180" cy="100" r="4.2" fill="#22D3EE" filter="url(#latestCoreGlow)" />
          <circle cx="180" cy="100" r="1.6" fill="#FFFFFF" />
        </g>

        {/* ── Central NeuBench Diamond Prism (Faceted, Levitation & Pulse) ── */}
        <g className="neubench-core-prism">

          {/* Outer Prism Aura Glow */}
          <polygon
            points="100,52 138,100 100,148 62,100"
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="2.4"
            strokeOpacity="0.4"
            filter="url(#latestGlow)"
          />

          {/* Solid Faceted Prism Body */}
          <polygon
            points="100,54 136,100 100,146 64,100"
            fill="url(#latestDiamondGrad)"
            stroke="url(#latestBeamGrad)"
            strokeWidth="1.6"
            filter="url(#latestGlow)"
          />

          {/* Facet Reflection Lines */}
          <line x1="100" y1="54" x2="100" y2="146" stroke="#C084FC" strokeWidth="0.8" strokeOpacity="0.45" />
          <line x1="64" y1="100" x2="136" y2="100" stroke="#22D3EE" strokeWidth="0.8" strokeOpacity="0.35" />

          {/* Concentric Broadcasting Radar Wave Arcs */}
          {/* Wave Arc Top */}
          <path
            d="M 88 84 A 18 18 0 0 1 112 84"
            fill="none"
            stroke="#C084FC"
            strokeWidth="1.6"
            strokeLinecap="round"
            filter="url(#latestGlow)"
          >
          </path>
          <path
            d="M 80 74 A 32 32 0 0 1 120 74"
            fill="none"
            stroke="#22D3EE"
            strokeWidth="1.6"
            strokeLinecap="round"
            filter="url(#latestGlow)"
          >
          </path>

          {/* Wave Arc Bottom */}
          <path
            d="M 88 116 A 18 18 0 0 0 112 116"
            fill="none"
            stroke="#C084FC"
            strokeWidth="1.6"
            strokeLinecap="round"
            filter="url(#latestGlow)"
          >
          </path>
          <path
            d="M 80 126 A 32 32 0 0 0 120 126"
            fill="none"
            stroke="#22D3EE"
            strokeWidth="1.6"
            strokeLinecap="round"
            filter="url(#latestGlow)"
          >
          </path>

          {/* Pulsing Luminous NeuBench Core Nucleus */}
          <circle cx="100" cy="100" r="10" fill="#151226" stroke="#8B5CF6" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="6" fill="#C084FC" filter="url(#latestCoreGlow)">
          </circle>
          <circle cx="100" cy="100" r="2.6" fill="#FFFFFF" />
        </g>
      </svg>
    </div>
  );
}

/**
 * 2. HeroTrendingArt - Velocity Thermal Flame (Amber / Ruby / Golden Heat)
 */
export function HeroTrendingArt() {
  return (
    <div aria-hidden="true" className="hero-art hero-logo-showcase hero-trending-art">
      <svg
        aria-label="Trending velocity fire"
        className="hero-animated-svg hero-fire-svg"
        fill="none"
        viewBox="0 0 200 200"
      >
        <defs>
          <radialGradient id="fireOuterNebula" cx="50%" cy="60%" r="50%">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#EF4444" stopOpacity="0.18" />
            <stop offset="80%" stopColor="#B45309" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fireGradOuter" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="40%" stopColor="#EA580C" />
            <stop offset="85%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#FBBF24" />
          </linearGradient>
          <linearGradient id="fireGradMid" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="90%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#FEF08A" />
          </linearGradient>
          <linearGradient id="fireGradCore" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="60%" stopColor="#FEF08A" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
          <filter id="fireGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="fireCoreGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient Thermal Energy Halo */}
        <circle cx="100" cy="115" fill="url(#fireOuterNebula)" r="88">
        </circle>

        {/* Thermal Shockwave Rings */}
        <circle cx="100" cy="120" fill="none" stroke="#F59E0B" strokeWidth="1.4">
        </circle>
        <circle cx="100" cy="120" fill="none" stroke="#EF4444" strokeWidth="1.4">
        </circle>

        {/* Rotating Velocity Gauge Orbit */}
        <circle
          cx="100"
          cy="105"
          r="86"
          stroke="#F59E0B"
          strokeOpacity="0.32"
          strokeWidth="1.2"
          strokeDasharray="4 8 16 8"
          fill="none"
        >
        </circle>

        {/* Rising Thermal Embers / Sparks */}
        <g className="fire-embers">
          {/* Spark 1 */}
          <circle cx="92" cy="80" r="2.2" fill="#FDE047" opacity="0.9" filter="url(#fireGlow)">
          </circle>
          {/* Spark 2 */}
          <circle cx="110" cy="90" r="2.4" fill="#F59E0B" opacity="0.85" filter="url(#fireGlow)">
          </circle>
          {/* Spark 3 */}
          <circle cx="102" cy="70" r="2" fill="#FEF08A" opacity="0.95" filter="url(#fireCoreGlow)">
          </circle>
          {/* Spark 4 */}
          <circle cx="82" cy="110" r="1.8" fill="#EF4444" opacity="0.8">
          </circle>
          {/* Spark 5 */}
          <circle cx="122" cy="115" r="1.8" fill="#FBBF24" opacity="0.85">
          </circle>
        </g>

        {/* ── Outer Flame Silhouette (Deep Crimson / Amber Flame Body) ── */}
        <g className="flame-layer-outer">
          <path
            d="M 100 24 
               C 114 48 126 62 138 82 
               C 152 104 156 128 144 148 
               C 134 164 116 172 100 172 
               C 84 172 66 164 56 148 
               C 44 128 48 104 62 82 
               C 74 62 86 48 100 24 Z"
            fill="url(#fireGradOuter)"
            filter="url(#fireGlow)"
            opacity="0.95"
          >
          </path>
        </g>

        {/* ── Mid Flame Tongue (Amber / Bright Yellow) ── */}
        <g className="flame-layer-mid">
          <path
            d="M 100 50 
               C 110 68 122 84 128 104 
               C 134 124 124 144 108 154 
               C 104 156 96 156 92 154 
               C 76 144 66 124 72 104 
               C 78 84 90 68 100 50 Z"
            fill="url(#fireGradMid)"
            filter="url(#fireGlow)"
          >
          </path>
        </g>

        {/* ── Inner White-Hot Heart Flame ── */}
        <g className="flame-layer-core">
          <path
            d="M 100 82 
               C 106 96 114 110 114 124 
               C 114 138 108 146 100 148 
               C 92 146 86 138 86 124 
               C 86 110 94 96 100 82 Z"
            fill="url(#fireGradCore)"
            filter="url(#fireCoreGlow)"
          >
          </path>
          {/* Pulsing White-Hot Plasma Center */}
          <circle cx="100" cy="128" r="6" fill="#FFFFFF" filter="url(#fireCoreGlow)">
          </circle>
        </g>
      </svg>
    </div>
  );
}

/**
 * 3. HeroSavedArt - Cyber Bookmark & Celestial Vault (Emerald Jade / Cyber Mint / Gold Starlight)
 */
export function HeroSavedArt() {
  return (
    <div aria-hidden="true" className="hero-art hero-logo-showcase hero-saved-art">
      <svg
        aria-label="Saved collection bookmark vault"
        className="hero-animated-svg hero-saved-svg"
        fill="none"
        viewBox="0 0 200 200"
      >
        <defs>
          <radialGradient id="savedOuterNebula" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#059669" stopOpacity="0.2" />
            <stop offset="78%" stopColor="#34D399" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="savedGradBookmark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="50%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="savedGradGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <filter id="savedGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="savedCoreGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient Emerald Nebula Field */}
        <circle cx="100" cy="100" fill="url(#savedOuterNebula)" r="92">
        </circle>

        {/* Hexagonal Vault Shield Ring (Clockwise, 30s) */}
        <circle
          cx="100"
          cy="100"
          r="88"
          stroke="#34D399"
          strokeOpacity="0.35"
          strokeWidth="1.3"
          strokeDasharray="4 8 16 8"
          fill="none"
        >
        </circle>

        {/* Orbiting Starlight Nodes */}
        <g>
          {/* Starlight Diamond 1 */}
          <g transform="translate(174, 100)">
            <polygon points="0,-7 3,0 7,0 2,3 4,8 0,4 -4,8 -2,3 -7,0 -3,0" fill="#FDE047" filter="url(#savedGlow)" />
          </g>
          {/* Starlight Diamond 2 */}
          <g transform="translate(26, 100)">
            <circle cx="0" cy="0" r="3" fill="#34D399" filter="url(#savedGlow)" />
          </g>
          {/* Top Node */}
          <circle cx="100" cy="24" r="2.5" fill="#6EE7B7" opacity="0.8" />
          {/* Bottom Node */}
          <circle cx="100" cy="176" r="2.5" fill="#FDE047" opacity="0.8" />
        </g>

        {/* Levitating Bookmark Ribbon Container */}
        <g className="saved-bookmark-levitate">
          {/* Smooth Vertical Levitation via SMIL */}

          {/* Outer Protective Ribbon Glow */}
          <path
            d="M 68 40 C 68 35 73 30 78 30 L 122 30 C 127 30 132 35 132 40 L 132 154 L 100 132 L 68 154 Z"
            fill="none"
            stroke="#10B981"
            strokeWidth="3"
            strokeOpacity="0.45"
            filter="url(#savedGlow)"
          />

          {/* Solid Faceted Bookmark Ribbon Body */}
          <path
            d="M 70 42 C 70 37 74 33 79 33 L 121 33 C 126 33 130 37 130 42 L 130 150 L 100 130 L 70 150 Z"
            fill="url(#savedGradBookmark)"
            stroke="#A7F3D0"
            strokeWidth="1.5"
            filter="url(#savedGlow)"
          />

          {/* Ribbon Inner Highlight Sheen */}
          <path
            d="M 76 40 L 98 40 L 98 128 L 76 142 Z"
            fill="#FFFFFF"
            fillOpacity="0.16"
          />

          {/* Cyber Eyelet / Lanyard Ring at Top */}
          <circle cx="100" cy="50" r="6" fill="#064E3B" stroke="#FDE047" strokeWidth="2" filter="url(#savedGlow)" />
          <circle cx="100" cy="50" r="2.2" fill="#FDE047" />

          {/* Central Sacred Starlight Badge */}
          <g transform="translate(100, 92)">
            {/* Pulsing Star Core */}
            <path
              d="M 0 -14 L 3 -4 L 14 0 L 3 4 L 0 14 L -3 4 L -14 0 L -3 -4 Z"
              fill="url(#savedGradGold)"
              filter="url(#savedCoreGlow)"
            >
            </path>
            <circle cx="0" cy="0" r="2.5" fill="#FFFFFF" />
          </g>

          {/* Bottom Accent Stitching Line */}
          <path
            d="M 78 138 L 100 123 L 122 138"
            stroke="#FDE047"
            strokeWidth="1.4"
            strokeDasharray="3 3"
            fill="none"
            opacity="0.85"
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * 4. HeroAboutArt - Neural Telemetry Core (Cyan Radar / Quantum Blue / Emerald)
 */
export function HeroAboutArt() {
  return (
    <div aria-hidden="true" className="hero-art hero-logo-showcase hero-about-art">
      <svg
        aria-label="About system neural radar"
        className="hero-animated-svg hero-about-svg"
        fill="none"
        viewBox="0 0 200 200"
      >
        <defs>
          <radialGradient id="aboutOuterNebula" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.4" />
            <stop offset="45%" stopColor="#3B82F6" stopOpacity="0.18" />
            <stop offset="78%" stopColor="#10B981" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="aboutGradCyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="aboutGradBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <filter id="aboutGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="aboutCoreGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient Cyan Nebula Glow */}
        <circle cx="100" cy="100" fill="url(#aboutOuterNebula)" r="92">
        </circle>

        {/* High-Tech Telemetry HUD Corner Brackets */}
        <g stroke="#22D3EE" strokeWidth="1.8" strokeLinecap="round" opacity="0.75">
          {/* Top-Left */}
          <path d="M 32 46 L 32 32 L 46 32" />
          {/* Top-Right */}
          <path d="M 154 32 L 168 32 L 168 46" />
          {/* Bottom-Left */}
          <path d="M 32 154 L 32 168 L 46 168" />
          {/* Bottom-Right */}
          <path d="M 154 168 L 168 168 L 168 154" />
        </g>

        {/* Outer Circular Telemetry Compass Grid */}
        <circle
          cx="100"
          cy="100"
          r="86"
          stroke="#06B6D4"
          strokeOpacity="0.3"
          strokeWidth="1.2"
          strokeDasharray="2 6 14 6"
          fill="none"
        >
        </circle>

        {/* Crosshair Alignment Guides */}
        <line x1="100" y1="18" x2="100" y2="28" stroke="#38BDF8" strokeWidth="1.5" opacity="0.6" />
        <line x1="100" y1="172" x2="100" y2="182" stroke="#38BDF8" strokeWidth="1.5" opacity="0.6" />
        <line x1="18" y1="100" x2="28" y2="100" stroke="#38BDF8" strokeWidth="1.5" opacity="0.6" />
        <line x1="172" y1="100" x2="182" y2="100" stroke="#38BDF8" strokeWidth="1.5" opacity="0.6" />

        {/* Gyroscopic Gimbal Ellipse 1 (Tilted 45deg, Clockwise 9s) */}
        <g transform="rotate(45 100 100)">
          <ellipse
            cx="100"
            cy="100"
            rx="68"
            ry="28"
            fill="none"
            stroke="url(#aboutGradCyan)"
            strokeWidth="1.6"
            strokeDasharray="18 8 26 8"
          >
          </ellipse>
        </g>

        {/* Gyroscopic Gimbal Ellipse 2 (Tilted -45deg, Counter-Clockwise 11s) */}
        <g transform="rotate(-45 100 100)">
          <ellipse
            cx="100"
            cy="100"
            rx="68"
            ry="28"
            fill="none"
            stroke="url(#aboutGradBlue)"
            strokeWidth="1.6"
            strokeDasharray="12 8 20 8"
          >
          </ellipse>
        </g>

        {/* 360-Degree Continuous Radar Sweep Beam */}
        <g>
          <line x1="100" y1="100" x2="164" y2="100" stroke="#22D3EE" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" filter="url(#aboutGlow)" />
          <circle cx="164" cy="100" r="3.2" fill="#22D3EE" filter="url(#aboutCoreGlow)" />
        </g>

        {/* Central Neural Intelligence Core Node */}
        <g>
          {/* Outer Rotating Cyber Hexagon Badge */}
          <polygon
            points="100,72 124,86 124,114 100,128 76,114 76,86"
            fill="#090E1A"
            stroke="#22D3EE"
            strokeWidth="2.2"
            filter="url(#aboutGlow)"
          />
          {/* Inner Glowing Core */}
          <polygon
            points="100,78 118,89 118,111 100,122 82,111 82,89"
            fill="url(#aboutGradCyan)"
            fillOpacity="0.25"
            stroke="#38BDF8"
            strokeWidth="1.2"
          />
          {/* Stylized Intelligence 'i' Glyph */}
          {/* Dot */}
          <circle cx="100" cy="89" r="3.2" fill="#FFFFFF" filter="url(#aboutCoreGlow)">
          </circle>
          {/* Stem */}
          <line x1="100" y1="97" x2="100" y2="114" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" filter="url(#aboutCoreGlow)">
          </line>
        </g>
      </svg>
    </div>
  );
}

/**
 * 5. HeroDigestArt - Daily Digest Executive Briefing Hub (Luminous Purple & Emerald)
 * Clean, animated holographic radar calendar and synthesis core.
 */
export function HeroDigestArt() {
  return (
    <div aria-hidden="true" className="hero-art hero-logo-showcase hero-digest-art">
      <svg
        aria-label="Daily digest synthesis beacon"
        className="hero-animated-svg hero-digest-svg"
        fill="none"
        viewBox="0 0 200 200"
      >
        <defs>
          <radialGradient id="digestOuterGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A855F7" stopOpacity="0.32" />
            <stop offset="55%" stopColor="#8B5CF6" stopOpacity="0.12" />
            <stop offset="85%" stopColor="#10B981" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="digestCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E1338" />
            <stop offset="100%" stopColor="#0D091A" />
          </linearGradient>
          <filter id="digestGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient Nebula */}
        <circle cx="100" cy="100" fill="url(#digestOuterGlow)" r="90">
        </circle>

        {/* Rotating Outer Radar Orbit */}
        <circle
          cx="100"
          cy="100"
          r="72"
          stroke="#A855F7"
          strokeWidth="1.2"
          strokeDasharray="8 6 2 6"
          opacity="0.5"
        >
        </circle>

        {/* Central Briefing Slate Card */}
        <g filter="url(#digestGlow)">
          <rect
            x="64"
            y="60"
            width="72"
            height="80"
            rx="12"
            fill="url(#digestCardGrad)"
            stroke="#C084FC"
            strokeWidth="1.8"
          />
          {/* Header strip */}
          <rect x="64" y="60" width="72" height="22" rx="10" fill="#2E1B4E" opacity="0.9" />
          {/* Calendar binder pins */}
          <circle cx="82" cy="59" r="2.5" fill="#E9D5FF" />
          <circle cx="118" cy="59" r="2.5" fill="#E9D5FF" />
          {/* Pulse Live Dot */}
          <circle cx="76" cy="71" r="3" fill="#10B981">
          </circle>
          {/* Header line */}
          <line x1="84" y1="71" x2="124" y2="71" stroke="#E9D5FF" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          {/* Body Lines */}
          <line x1="74" y1="92" x2="126" y2="92" stroke="#C084FC" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
          <line x1="74" y1="104" x2="116" y2="104" stroke="#DDD6FE" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <line x1="74" y1="116" x2="122" y2="116" stroke="#DDD6FE" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <line x1="74" y1="127" x2="98" y2="127" stroke="#10B981" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
        </g>
      </svg>
    </div>
  );
}

/**
 * 6. HeroFeedbackArt - Community & Connection Constellation (Sky Blue & Indigo)
 * Communicating node pulses and interactive transmission arcs.
 */
export function HeroFeedbackArt() {
  return (
    <div aria-hidden="true" className="hero-art hero-logo-showcase hero-feedback-art">
      <svg
        aria-label="Feedback and community connection beacon"
        className="hero-animated-svg hero-feedback-svg"
        fill="none"
        viewBox="0 0 200 200"
      >
        <defs>
          <radialGradient id="feedbackOuterGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.3" />
            <stop offset="55%" stopColor="#6366F1" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bubbleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#18181b" />
          </linearGradient>
          <filter id="feedbackGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Glow */}
        <circle cx="100" cy="100" fill="url(#feedbackOuterGlow)" r="92">
        </circle>

        {/* Orbiting Connection Ring */}
        <circle
          cx="100"
          cy="100"
          r="74"
          stroke="#6366F1"
          strokeWidth="1.2"
          strokeDasharray="6 6"
          opacity="0.4"
        >
        </circle>

        {/* Primary Communicating Chat Bubble */}
        <g filter="url(#feedbackGlow)">
          <path
            d="M62 65 C62 55, 138 55, 138 65 L138 115 C138 125, 62 125, 62 115 Z"
            fill="url(#bubbleGrad)"
            stroke="#38BDF8"
            strokeWidth="1.8"
          />
          {/* Bubble tail */}
          <polygon points="76,124 70,138 90,124" fill="#18181b" stroke="#38BDF8" strokeWidth="1.5" />
          {/* Conversation Frequency Bars */}
          <rect x="78" y="82" width="6" height="18" rx="3" fill="#38BDF8">
          </rect>
          <rect x="90" y="78" width="6" height="26" rx="3" fill="#818CF8">
          </rect>
          <rect x="102" y="84" width="6" height="16" rx="3" fill="#C084FC">
          </rect>
          <rect x="114" y="80" width="6" height="22" rx="3" fill="#38BDF8">
          </rect>
        </g>

        {/* Satellite Node Orbiting */}
        <g>
          <circle cx="150" cy="70" r="5" fill="#38BDF8" filter="url(#feedbackGlow)">
          </circle>
          <line x1="138" y1="80" x2="150" y2="70" stroke="#38BDF8" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
        </g>
      </svg>
    </div>
  );
}



/**
 * 7. HeroBenchmarksArt - Multi-Axis Capability Radar Nexus (Cyan / Electric Violet / Emerald)
 * Precision telemetry, multi-dimensional capability radar, rotating orbital coordinate rings,
 * and glowing metric vertices.
 */
export function HeroBenchmarksArt() {
  return (
    <div aria-hidden="true" className="hero-art hero-logo-showcase hero-benchmarks-art">
      <svg
        aria-label="Multi-axis model capability radar"
        className="hero-animated-svg hero-benchmarks-svg"
        fill="none"
        viewBox="0 0 200 200"
      >
        <defs>
          <radialGradient id="benchmarksNebula" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F472B6" stopOpacity="0.32" />
            <stop offset="50%" stopColor="#DB2777" stopOpacity="0.14" />
            <stop offset="85%" stopColor="#F472B6" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#F472B6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="radarSweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F472B6" stopOpacity="0.65" />
            <stop offset="60%" stopColor="#F472B6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#F472B6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="benchPolyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F472B6" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#F472B6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#F472B6" stopOpacity="0.15" />
          </linearGradient>
          <filter id="benchGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="benchCoreGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient Nebula */}
        <circle cx="100" cy="100" fill="url(#benchmarksNebula)" r="92">
        </circle>

        {/* Concentric Telemetry Grid Rings */}
        <circle cx="100" cy="100" r="76" stroke="#8B5CF6" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 6" fill="none" />
        <circle cx="100" cy="100" r="54" stroke="#06B6D4" strokeOpacity="0.22" strokeWidth="1" strokeDasharray="2 4" fill="none" />
        <circle cx="100" cy="100" r="32" stroke="#10B981" strokeOpacity="0.2" strokeWidth="1" fill="none" />

        {/* Hexagonal Outer Boundary */}
        <polygon
          points="100,24 165,62 165,138 100,176 35,138 35,62"
          stroke="#8B5CF6"
          strokeOpacity="0.3"
          strokeWidth="1.2"
          fill="none"
        />

        {/* 6 Capability Axis Spoke Lines */}
        <g stroke="#a1a1aa" strokeOpacity="0.22" strokeWidth="1">
          <line x1="100" y1="24" x2="100" y2="176" />
          <line x1="35" y1="62" x2="165" y2="138" />
          <line x1="35" y1="138" x2="165" y2="62" />
        </g>

        {/* Rotating Outer Degree Calibration Ring */}
        <circle
          cx="100"
          cy="100"
          r="84"
          stroke="#22D3EE"
          strokeOpacity="0.35"
          strokeWidth="1.2"
          strokeDasharray="4 8 20 8"
          fill="none"
        >
        </circle>

        {/* Counter-Rotating Inner Telemetry Track */}
        <circle
          cx="100"
          cy="100"
          r="66"
          stroke="#C084FC"
          strokeOpacity="0.28"
          strokeWidth="1"
          strokeDasharray="6 12 18 12"
          fill="none"
        >
        </circle>

        {/* Active Model Benchmark Capability Polygon (Morphing/Pulsing) */}
        <polygon
          points="100,42 152,70 144,130 100,154 52,126 58,68"
          fill="url(#benchPolyGrad)"
          stroke="#22D3EE"
          strokeWidth="1.8"
          filter="url(#benchGlow)"
        >
        </polygon>

        {/* Benchmark Domain Vertex Nodes */}
        <circle cx="100" cy="42" r="3.5" fill="#34D399" filter="url(#benchGlow)">
        </circle>
        <circle cx="152" cy="70" r="3.5" fill="#22D3EE" filter="url(#benchGlow)">
        </circle>
        <circle cx="144" cy="130" r="3.5" fill="#C084FC" filter="url(#benchGlow)">
        </circle>
        <circle cx="100" cy="154" r="3.5" fill="#F43F5E" filter="url(#benchGlow)">
        </circle>
        <circle cx="52" cy="126" r="3.5" fill="#FBBF24" filter="url(#benchGlow)">
        </circle>
        <circle cx="58" cy="68" r="3.5" fill="#FB923C" filter="url(#benchGlow)">
        </circle>

        {/* Rhythmic Radar Sweep Needle */}
        <g>
          <line x1="100" y1="100" x2="100" y2="24" stroke="url(#radarSweepGrad)" strokeWidth="2" strokeLinecap="round" />
          <polygon points="100,100 100,24 130,34" fill="url(#radarSweepGrad)" opacity="0.35" />
        </g>

        {/* Central Core Pulse Beacon */}
        <circle cx="100" cy="100" r="12" fill="#18181b" stroke="#22D3EE" strokeWidth="1.6" filter="url(#benchCoreGlow)" />
        <circle cx="100" cy="100" r="5" fill="#A78BFA">
        </circle>
      </svg>
    </div>
  );
}
